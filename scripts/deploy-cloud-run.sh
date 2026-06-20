#!/usr/bin/env bash
# Deploy pre-built images to Cloud Run via Aspire-generated Compose.
# Requires gcloud auth, aspire CLI, and npm deps (run from repo root).
set -euo pipefail

: "${RELEASE_VERSION:?RELEASE_VERSION is required}"
: "${COMPOSE_SERVICE_NAME:?COMPOSE_SERVICE_NAME is required}"

export REGISTRY="${REGISTRY:-us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy}"
export IMAGE_TAG="$RELEASE_VERSION"
export AI_IMAGE="${REGISTRY}/thethinker-ai:${RELEASE_VERSION}"
export BACKEND_IMAGE="${REGISTRY}/thethinker-backend:${RELEASE_VERSION}"
export FRONTEND_IMAGE="${REGISTRY}/thethinker-frontend:${RELEASE_VERSION}"

export ANTHROPICAPIKEY="${ANTHROPICAPIKEY:-${ANTHROPIC_API_KEY:-}}"
export JWTSECRET="${JWTSECRET:-${JWT_SECRET:-}}"
export WEATHERAPIKEY="${WEATHERAPIKEY:-${WEATHER_API_KEY:-}}"
export DATABASEURL="${DATABASE_URL:-postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/thethinker}"
export CLOUDSQLINSTANCE="${CLOUD_SQL_INSTANCE:-thethinker:us-central1:thethinker-db}"
export GCSBUCKET="${GCS_BUCKET:-thethinker-wardrobe-images}"
export GOOGLECLIENTID="${GOOGLE_CLIENT_ID:-176526137598-8hme48480tc0gajdttlrpv9qu4g9c7a7.apps.googleusercontent.com}"
export GOOGLECLIENTSECRET="${GOOGLE_CLIENT_SECRET:-${GOOGLECLIENTSECRET:-}}"

: "${ANTHROPICAPIKEY:?ANTHROPICAPIKEY or ANTHROPIC_API_KEY is required}"
: "${JWTSECRET:?JWTSECRET or JWT_SECRET is required}"
: "${WEATHERAPIKEY:?WEATHERAPIKEY or WEATHER_API_KEY is required}"
: "${GOOGLECLIENTSECRET:?GOOGLE_CLIENT_SECRET is required}"

export Parameters__databaseUrl="$DATABASEURL"
export Parameters__gcsBucket="$GCSBUCKET"
export Parameters__googleClientId="$GOOGLECLIENTID"
export Parameters__googleClientSecret="$GOOGLECLIENTSECRET"
export Parameters__jwtSecret="$JWTSECRET"
export Parameters__anthropicApiKey="$ANTHROPICAPIKEY"
export Parameters__weatherApiKey="$WEATHERAPIKEY"
export Parameters__cloudSqlInstance="$CLOUDSQLINSTANCE"
export COMPOSE_SERVICE_NAME

rm -rf aspire-output
aspire publish -o ./aspire-output --environment production --non-interactive
npm run validate:production-compose -- ./aspire-output/docker-compose.yaml \
  --image-tag "$RELEASE_VERSION" \
  --service-name "$COMPOSE_SERVICE_NAME"

if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
  gcloud builds submit \
    --config cloudbuild.yaml \
    --substitutions="_TAG=${RELEASE_VERSION},_VITE_GOOGLE_CLIENT_ID=${GOOGLECLIENTID}" \
    .
fi

for image in "$AI_IMAGE" "$BACKEND_IMAGE" "$FRONTEND_IMAGE"; do
  gcloud artifacts docker images describe "$image"
done

if [[ "${SKIP_DRY_RUN:-false}" != "true" ]]; then
  gcloud run compose up ./aspire-output/docker-compose.yaml \
    --dry-run \
    --no-build \
    --allow-unauthenticated \
    --region "${GCP_REGION:-us-central1}" \
    --project "${GCP_PROJECT:-thethinker}"
fi

gcloud run compose up ./aspire-output/docker-compose.yaml \
  --no-build \
  --allow-unauthenticated \
  --region "${GCP_REGION:-us-central1}" \
  --project "${GCP_PROJECT:-thethinker}"
