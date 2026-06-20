// Aspire TypeScript AppHost use /aspire for more info
// Production deployment guide: docs/aspire-deploy.md

import { createBuilder, EndpointProperty } from "./.aspire/modules/aspire.mjs";
import { refExpr } from "./.aspire/modules/base.mjs";

const builder = await createBuilder();
const isPublish = await builder.executionContext().isPublishMode();

// ── Deployment constants ────────────────────────────────────────────────────

const ARTIFACT_REGISTRY = "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy";
const DEFAULT_CLOUD_SQL_INSTANCE = "thethinker:us-central1:thethinker-db";
const CLOUD_SQL_PROXY_IMAGE = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0";
const BACKEND_LISTEN_PORT = "8081";
const imageTag = process.env.CI_COMMIT_TAG ?? process.env.IMAGE_TAG ?? "latest";

function resolveCloudSqlInstance(): string {
  return (
    process.env.Parameters__cloudSqlInstance ??
    process.env.CLOUD_SQL_INSTANCE ??
    DEFAULT_CLOUD_SQL_INSTANCE
  );
}

// ── Shared parameters (dev + production) ────────────────────────────────────

const jwtSecret = builder.addParameter("jwtSecret", { secret: true });

const anthropicApiKey = builder.addParameter("anthropicApiKey", {
  secret: true,
});

const weatherApiKey = builder.addParameter("weatherApiKey", {
  secret: true,
  value: process.env.WEATHER_API_KEY ?? "",
});

const googleClientId = builder.addParameter("googleClientId");
const googleClientSecret = builder.addParameter("googleClientSecret", {
  secret: true,
});

const gcsBucket = builder.addParameter("gcsBucket", {
  value: process.env.GCS_BUCKET ?? (isPublish ? "thethinker-wardrobe-images" : "wardrobe-images"),
});

// ── Database ────────────────────────────────────────────────────────────────
// Dev: local Postgres. Production: Cloud SQL via auth proxy sidecar.

let pgServer: Awaited<ReturnType<typeof builder.addPostgres>> | null = null;
let dbUri: ReturnType<typeof builder.addParameter> | ReturnType<typeof refExpr> =
  builder.addParameter("databaseUrl", { secret: true });

if (!isPublish) {
  pgServer = await builder.addPostgres("db");
  await pgServer.withDataVolume({ name: "thethinker-pgdata" });
  await pgServer.withPersistentLifetime();
  const db = await pgServer.addDatabase("thethinker");
  dbUri = await db.uriExpression();
} else if (!process.env.Parameters__databaseUrl) {
  const dbPassword = await builder.addParameter("dbPassword", { secret: true });
  dbUri = refExpr`postgresql://postgres:${dbPassword}@127.0.0.1:5432/thethinker`;
}

let cloudSqlProxy: Awaited<ReturnType<typeof builder.addContainer>> | null = null;
if (isPublish) {
  cloudSqlProxy = await builder.addContainer("cloudsql-proxy", CLOUD_SQL_PROXY_IMAGE);
  await cloudSqlProxy.withArgs([
    "--port=5432",
    "--address=0.0.0.0",
    resolveCloudSqlInstance(),
  ]);
  await cloudSqlProxy.withHttpEndpoint({ port: 5432, targetPort: 5432, name: "tcp" });
}

// ── Image storage ───────────────────────────────────────────────────────────
// Dev: fake-gcs-server emulator. Production: real GCS via Cloud Run ADC (no JSON in env).

let gcs: Awaited<ReturnType<typeof builder.addContainer>> | null = null;
if (!isPublish) {
  gcs = await builder.addContainer("gcs", "fsouza/fake-gcs-server:1.49");
  await gcs.withArgs([
    "-scheme",
    "http",
    "-port",
    "4443",
    "-backend",
    "filesystem",
  ]);
  await gcs.withVolume("/storage", { name: "thethinker-gcsdata" });
  await gcs.withHttpEndpoint({ port: 4443, targetPort: 4443, isProxied: false });
}

// ── AI service ──────────────────────────────────────────────────────────────

const ai = await builder.addDockerfile("ai", "./ai");
await ai.withHttpEndpoint({ port: 8001, targetPort: 8001, name: "http" });
await ai.withEnvironment("ANTHROPIC_API_KEY", anthropicApiKey);
await ai.withRemoteImageName(`${ARTIFACT_REGISTRY}/thethinker-ai`);
await ai.withRemoteImageTag(imageTag);

// ── Backend ─────────────────────────────────────────────────────────────────

const backend = await builder.addGoApp("backend", "./backend", {
  packagePath: "./cmd/api",
});
await backend.withHttpEndpoint({ port: 8081, targetPort: 8081, env: "PORT" });
await backend.withEnvironment("DATABASE_URL", dbUri);
await backend.withEnvironment("JWT_SECRET", jwtSecret);
await backend.withEnvironment("AI_SERVICE_URL", ai.getEndpoint("http"));
await backend.withEnvironment("OTEL_SERVICE_NAME", "thethinker-api");
await backend.withEnvironment("GCS_BUCKET", gcsBucket);
if (!isPublish && gcs) {
  await backend.withEnvironment("GCS_EMULATOR_HOST", "localhost:4443");
  await backend.waitFor(gcs);
}
await backend.withEnvironment("WEATHER_API_KEY", weatherApiKey);
await backend.withEnvironment("GOOGLE_CLIENT_ID", googleClientId);
await backend.withEnvironment("GOOGLE_CLIENT_SECRET", googleClientSecret);
if (cloudSqlProxy) {
  await backend.waitFor(cloudSqlProxy);
} else if (pgServer) {
  await backend.waitFor(pgServer);
}
await backend.waitFor(ai);
await backend.withRemoteImageName(`${ARTIFACT_REGISTRY}/thethinker-backend`);
await backend.withRemoteImageTag(imageTag);

// Dev-only dashboard action: reset DB and preload wardrobe images.
if (pgServer) {
  await pgServer.withCommand(
    "seed",
    "Seed Dev Data",
    async (_ctx) => {
      try {
        const backendUrl = await backend.getEndpoint("http").url();
        const res = await fetch(`${backendUrl}/dev/seed`, {
          method: "POST",
        });
        const text = await res.text();
        if (!res.ok) {
          return { success: false, message: text };
        }
        return { success: true, message: text.trim() };
      } catch (err) {
        return { success: false, message: String(err) };
      }
    },
    {
      commandOptions: {
        description:
          "Truncate and re-populate the DB with test users and wardrobe items (dev only).",
        confirmationMessage:
          "This will DELETE all existing wardrobe data and re-seed from scratch.\n\nTwo test accounts will be created:\n  dev@thethinker.com  /  password123\n  jane@thethinker.com /  password123\n\nContinue?",
        isHighlighted: true,
        iconName: "DatabaseArrowRight",
      },
    },
  );
}

// ── Frontend ────────────────────────────────────────────────────────────────
// Dev: Vite on a fixed :5173 origin for Google OAuth. Production: nginx image.

if (!isPublish) {
  const frontend = await builder.addViteApp("frontend", "./frontend");
  await frontend.withNpm();
  await frontend.withHttpEndpoint({
    port: 5173,
    targetPort: 5173,
    isProxied: false,
    env: "PORT",
  });
  await frontend.withEnvironment("VITE_BACKEND_URL", backend.getEndpoint("http"));
  await frontend.withEnvironment("VITE_GOOGLE_CLIENT_ID", googleClientId);
  await frontend.withExternalHttpEndpoints();
  await frontend.waitFor(backend);
} else {
  const frontend = await builder.addDockerfile("frontend", "./frontend");
  await frontend.withBuildArg("VITE_GOOGLE_CLIENT_ID", googleClientId);
  await frontend.withHttpEndpoint({ port: 8080, targetPort: 8080, env: "PORT" });
  await frontend.withEnvironment(
    "BACKEND_URL",
    await backend.getEndpoint("http").property(EndpointProperty.HostAndPort),
  );
  await frontend.withEnvironment("NODE_ENV", "production");
  await frontend.withExternalHttpEndpoints();
  await frontend.waitFor(backend);
  await frontend.withRemoteImageName(`${ARTIFACT_REGISTRY}/thethinker-frontend`);
  await frontend.withRemoteImageTag(imageTag);
}

// ── Production Compose customization ────────────────────────────────────────
// Cloud Run ingress rules: only frontend publishes a port; PORT is injected at runtime.

const compose = await builder.addDockerComposeEnvironment("compose");
await compose.configureComposeFile(async (composeFile) => {
  if (!isPublish) return;

  // Cloud Run service name comes from the Compose project `name:` field (defaults to
  // the output directory name, e.g. aspire-output). Pin to the production service.
  await composeFile.name.set("thethinker");

  await composeFile.services.remove("compose-dashboard");
  await composeFile.volumes.remove("thethinker-pgdata");

  for (const serviceName of ["ai", "backend", "frontend"]) {
    const service = await composeFile.services.get(serviceName);
    await service.environment.remove("OTEL_EXPORTER_OTLP_ENDPOINT");
    await service.environment.remove("OTEL_EXPORTER_OTLP_PROTOCOL");
  }

  const backendService = await composeFile.services.get("backend");
  await backendService.environment.remove("GCS_CREDENTIALS_JSON");

  const frontendService = await composeFile.services.get("frontend");
  await frontendService.environment.remove("PORT");

  // Cloud Run multi-container shares one network namespace — sidecars reach each
  // other via 127.0.0.1:<port>, not Docker DNS names like backend:8081.
  await frontendService.environment.set(
    "BACKEND_URL",
    `127.0.0.1:${BACKEND_LISTEN_PORT}`,
  );
});

await builder.build().run();
