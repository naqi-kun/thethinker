#!/usr/bin/env bash
# Provision long-lived GCP resources for the staging environment.
# Requires a principal with Cloud SQL Admin + Storage Admin (or Owner) on project thethinker.
#
# Usage:
#   export DB_PASSWORD='<same value as GitLab CI variable DB_PASSWORD>'
#   ./scripts/provision-staging-infra.sh
#
# Idempotent — safe to re-run.
set -euo pipefail

PROJECT="${GCP_PROJECT:-thethinker}"
REGION="${GCP_REGION:-us-central1}"
SQL_INSTANCE="${STAGING_SQL_INSTANCE:-thethinker-staging-db}"
SQL_DATABASE="${STAGING_SQL_DATABASE:-thethinker}"
GCS_BUCKET="${STAGING_GCS_BUCKET:-thethinker-staging-wardrobe-images}"
RUNTIME_SA="${CLOUD_RUN_RUNTIME_SA:-719713084003-compute@developer.gserviceaccount.com}"

: "${DB_PASSWORD:?Set DB_PASSWORD to the GitLab CI variable value (shared with prod deploy)}"

gcloud config set project "$PROJECT" >/dev/null

echo "==> GCS bucket gs://${GCS_BUCKET}"
if gsutil ls -b "gs://${GCS_BUCKET}" >/dev/null 2>&1; then
  echo "    exists — skipping create"
else
  gsutil mb -p "$PROJECT" -l "$REGION" "gs://${GCS_BUCKET}"
fi

echo "==> GCS IAM (runtime SA objectAdmin + public objectViewer)"
gsutil iam ch "serviceAccount:${RUNTIME_SA}:roles/storage.objectAdmin" "gs://${GCS_BUCKET}" 2>/dev/null || true
gsutil iam ch allUsers:roles/storage.objectViewer "gs://${GCS_BUCKET}" 2>/dev/null || true

echo "==> Cloud SQL instance ${SQL_INSTANCE}"
if gcloud sql instances describe "$SQL_INSTANCE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "    exists — skipping create"
else
  gcloud sql instances create "$SQL_INSTANCE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --database-version=POSTGRES_15 \
    --edition=ENTERPRISE \
    --tier=db-f1-micro \
    --storage-size=10GB \
    --storage-type=SSD \
    --root-password="$DB_PASSWORD"
fi

echo "==> Cloud SQL database ${SQL_DATABASE}"
if gcloud sql databases describe "$SQL_DATABASE" --instance="$SQL_INSTANCE" --project="$PROJECT" >/dev/null 2>&1; then
  echo "    exists — skipping create"
else
  gcloud sql databases create "$SQL_DATABASE" \
    --instance="$SQL_INSTANCE" \
    --project="$PROJECT"
fi

echo "==> Preflight"
gcloud sql instances describe "$SQL_INSTANCE" --project="$PROJECT" --format='value(connectionName)'
gsutil ls -b "gs://${GCS_BUCKET}" >/dev/null
echo "Staging infra ready."
