// Production deployment guide: docs/aspire-deploy.md
import { createBuilder } from "./.aspire/modules/aspire.mjs";
import { configureAi } from "./apphost/ai.mjs";
import { configureBackend } from "./apphost/backend.mjs";
import {
  configureDatabase,
  configureDevSeedCommand,
} from "./apphost/database.mjs";
import { configureFrontend } from "./apphost/frontend.mjs";
import { configurePublishCompose } from "./apphost/publish-compose.mjs";
import { configureStorage } from "./apphost/storage.mjs";

const builder = await createBuilder();
const isPublish = await builder.executionContext().isPublishMode();

const ARTIFACT_REGISTRY =
  "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy";
const DEFAULT_CLOUD_SQL_INSTANCE = "thethinker:us-central1:thethinker-db";
const CLOUD_SQL_PROXY_IMAGE =
  "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0";
const BACKEND_LISTEN_PORT = "8081";
const AI_LISTEN_PORT = "8001";
const DEFAULT_COMPOSE_SERVICE_NAME = "thethinker";

const imageTag =
  process.env.RELEASE_VERSION ??
  process.env.CI_COMMIT_TAG ??
  process.env.IMAGE_TAG ??
  "latest";

const composeServiceName =
  process.env.COMPOSE_SERVICE_NAME ?? DEFAULT_COMPOSE_SERVICE_NAME;

function artifactImage(name: "ai" | "backend" | "frontend"): string {
  return `${ARTIFACT_REGISTRY}/thethinker-${name}`;
}

function resolveCloudSqlInstance(): string {
  return (
    process.env.Parameters__cloudSqlInstance ??
    process.env.CLOUD_SQL_INSTANCE ??
    DEFAULT_CLOUD_SQL_INSTANCE
  );
}

// ── Shared parameters (dev + production) ────────────────────────────────────

const jwtSecret = builder.addParameter("jwtSecret", { secret: true });
const anthropicApiKey = builder.addParameter("anthropicApiKey", { secret: true });
const weatherApiKey = builder.addParameter("weatherApiKey", {
  secret: true,
  value: process.env.WEATHER_API_KEY ?? "",
});
const googleClientId = builder.addParameter("googleClientId");
const googleClientSecret = builder.addParameter("googleClientSecret", {
  secret: true,
});
const gcsBucket = builder.addParameter("gcsBucket", {
  value:
    process.env.GCS_BUCKET ??
    (isPublish ? "thethinker-wardrobe-images" : "wardrobe-images"),
});

// ── Database ────────────────────────────────────────────────────────────────

const database = await configureDatabase({
  builder,
  isPublish,
  cloudSqlProxyImage: CLOUD_SQL_PROXY_IMAGE,
  resolveCloudSqlInstance,
});

// ── Image storage ───────────────────────────────────────────────────────────

const storage = await configureStorage(builder, isPublish);

// ── AI service ──────────────────────────────────────────────────────────────

const ai = await configureAi({
  builder,
  anthropicApiKey,
  imageTag,
  artifactImage,
});

// ── Backend ─────────────────────────────────────────────────────────────────

const backend = await configureBackend({
  builder,
  database,
  storage,
  ai,
  dbUri: database.url,
  jwtSecret,
  gcsBucket,
  weatherApiKey,
  googleClientId,
  googleClientSecret,
  imageTag,
  artifactImage,
});

if (database.mode === "dev") {
  await configureDevSeedCommand(database, backend);
}

// ── Frontend ────────────────────────────────────────────────────────────────

await configureFrontend(builder, isPublish, {
  builder,
  backend,
  googleClientId,
  imageTag,
  artifactImage,
});

// ── Production Compose customization ────────────────────────────────────────

await configurePublishCompose({
  builder,
  isPublish,
  composeServiceName,
  aiListenPort: AI_LISTEN_PORT,
  backendListenPort: BACKEND_LISTEN_PORT,
});

await builder.build().run();
