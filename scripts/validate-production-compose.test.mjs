import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateProductionCompose } from "./validate-production-compose.mjs";

async function writeCompose(contents) {
  const dir = await mkdtemp(join(tmpdir(), "thethinker-compose-"));
  const filePath = join(dir, "docker-compose.yaml");
  await writeFile(filePath, contents);
  return filePath;
}

const validCompose = `
name: "thethinker"
services:
  ai:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-ai:v1.2.3"
    environment:
      ANTHROPIC_API_KEY: "\${ANTHROPICAPIKEY}"
    expose:
      - "8001"
  backend:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-backend:v1.2.3"
    environment:
      PORT: "8081"
      DATABASE_URL: "\${DATABASEURL}"
      JWT_SECRET: "\${JWTSECRET}"
      AI_SERVICE_URL: "http://ai:8001"
      GCS_BUCKET: "\${GCSBUCKET}"
      WEATHER_API_KEY: "\${WEATHERAPIKEY}"
      GOOGLE_CLIENT_ID: "\${GOOGLECLIENTID}"
      GOOGLE_CLIENT_SECRET: "\${GOOGLECLIENTSECRET}"
    expose:
      - "8081"
    depends_on:
      ai:
        condition: "service_started"
      cloudsql-proxy:
        condition: "service_started"
  cloudsql-proxy:
    image: "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0"
    command:
      - "--port=5432"
      - "--address=0.0.0.0"
      - "\${CLOUDSQLINSTANCE}"
    expose:
      - "5432"
  frontend:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-frontend:v1.2.3"
    environment:
      NODE_ENV: "production"
      BACKEND_URL: "127.0.0.1:8081"
      VITE_GOOGLE_CLIENT_ID: "\${GOOGLECLIENTID}"
    ports:
      - "8080:8080"
    depends_on:
      backend:
        condition: "service_started"
`;

test("accepts the production Cloud Run Compose topology", async () => {
  const filePath = await writeCompose(validCompose);

  const result = await validateProductionCompose(filePath, { imageTag: "v1.2.3" });

  assert.deepEqual(result.errors, []);
});

test("rejects backend GCS_CREDENTIALS_JSON in production compose", async () => {
  const filePath = await writeCompose(`
services:
  ai:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-ai:v1.2.3"
    expose:
      - "8001"
  backend:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-backend:v1.2.3"
    environment:
      PORT: "8081"
      DATABASE_URL: "\${DATABASEURL}"
      GCS_BUCKET: "\${GCSBUCKET}"
      GCS_CREDENTIALS_JSON: "\${GCSCREDENTIALSJSON}"
    expose:
      - "8081"
    depends_on:
      ai:
        condition: "service_started"
      cloudsql-proxy:
        condition: "service_started"
  cloudsql-proxy:
    image: "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0"
    command:
      - "--port=5432"
      - "--address=0.0.0.0"
      - "thethinker:us-central1:thethinker-db"
    expose:
      - "5432"
  frontend:
    image: "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/thethinker-frontend:v1.2.3"
    environment:
      BACKEND_URL: "127.0.0.1:8081"
    ports:
      - "8080:8080"
    depends_on:
      backend:
        condition: "service_started"
`);

  const result = await validateProductionCompose(filePath, { imageTag: "v1.2.3" });

  assert.match(result.errors.join("\n"), /must not set GCS_CREDENTIALS_JSON/);
});

test("rejects the current dev-style Aspire Compose topology", async () => {
  const filePath = await writeCompose(`
services:
  compose-dashboard:
    image: "mcr.microsoft.com/dotnet/nightly/aspire-dashboard:latest"
  db:
    image: "docker.io/library/postgres:18.3"
  ai:
    image: "\${AI_IMAGE}"
    environment:
      ANTHROPIC_API_KEY: "\${ANTHROPICAPIKEY}"
    expose:
      - "8001"
  backend:
    image: "\${BACKEND_IMAGE}"
    environment:
      PORT: "8000"
      DATABASE_URL: "postgresql://postgres:\${DB_PASSWORD}@db:5432/thethinker"
      GCS_BUCKET: "wardrobe-images"
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://compose-dashboard:18889"
    expose:
      - "8000"
    depends_on:
      db:
        condition: "service_started"
      ai:
        condition: "service_started"
  frontend:
    image: "\${FRONTEND_IMAGE}"
    environment:
      PORT: "5173"
      VITE_BACKEND_URL: "http://backend:8000"
    ports:
      - "5173:5173"
    depends_on:
      backend:
        condition: "service_started"
`);

  const result = await validateProductionCompose(filePath, { imageTag: "v1.2.3" });

  assert.match(result.errors.join("\n"), /must not include local db service/);
  assert.match(result.errors.join("\n"), /must not include compose-dashboard/);
  assert.match(result.errors.join("\n"), /cloudsql-proxy service is required/);
  assert.match(result.errors.join("\n"), /frontend must publish Cloud Run ingress port 8080/);
  assert.match(result.errors.join("\n"), /reserved PORT env/);
  assert.match(result.errors.join("\n"), /backend DATABASE_URL must come from/);
});

test("CLI exits non-zero and prints validation errors", async () => {
  const filePath = await writeCompose(`
services:
  backend:
    image: "\${BACKEND_IMAGE}"
`);

  const result = spawnSync(
    process.execPath,
    ["scripts/validate-production-compose.mjs", filePath, "--image-tag", "v1.2.3"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Production Compose validation failed/);
  assert.match(result.stderr, /frontend service is required/);
});

test("nginx production proxy strips the /api prefix", () => {
  const nginxConfig = readFileSync("frontend/nginx.conf", "utf8");

  assert.match(nginxConfig, /location\s+\/api\/\s+\{/);
  assert.match(nginxConfig, /proxy_pass\s+http:\/\/\$\{BACKEND_URL\}\/;/);
});
