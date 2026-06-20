#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const ARTIFACT_REGISTRY_PREFIX =
  "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy/";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function serviceEnv(service) {
  const env = service.environment;
  if (Array.isArray(env)) {
    return Object.fromEntries(
      env.map((entry) => {
        const [key, ...rest] = String(entry).split("=");
        return [key, rest.join("=")];
      }),
    );
  }
  return asObject(env);
}

function hasDependency(service, name) {
  const dependsOn = service.depends_on;
  if (Array.isArray(dependsOn)) {
    return dependsOn.includes(name);
  }
  return Object.hasOwn(asObject(dependsOn), name);
}

function servicePorts(service) {
  return [...asStringList(service.ports), ...asStringList(service.expose)];
}

function isParameterReference(value, parameterNames) {
  if (typeof value !== "string") return false;
  return parameterNames.some((name) => value === `\${${name}}`);
}

function imageUsesTag(image, imageTag) {
  if (typeof image !== "string") return false;
  const placeholder = image.match(/^\$\{([A-Z0-9_]+)\}$/);
  if (placeholder) {
    return imageUsesTag(process.env[placeholder[1]], imageTag);
  }
  if (!image.startsWith(ARTIFACT_REGISTRY_PREFIX)) return false;
  if (imageTag) return image.endsWith(`:${imageTag}`);
  return /\$\{(?:IMAGE_TAG|IMAGETAG)\}$/.test(image) || /:[^/:]+$/.test(image);
}

function isCloudSqlConnectionName(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]*:[a-z0-9-]+:[a-z][a-z0-9-]*$/.test(value);
}

export async function validateProductionCompose(filePath, options = {}) {
  const imageTag = options.imageTag ?? process.env.CI_COMMIT_TAG ?? process.env.IMAGE_TAG;
  const contents = await readFile(filePath, "utf8");
  const compose = parse(contents);
  const services = asObject(compose?.services);
  const errors = [];

  if (compose?.name !== "thethinker") {
    errors.push('production Compose project name must be "thethinker" (Cloud Run service name)');
  }

  if (!Object.keys(services).length) {
    errors.push("docker-compose.yaml must define services");
    return { errors };
  }

  if (services.db) {
    errors.push("production Compose must not include local db service");
  }
  if (services["compose-dashboard"]) {
    errors.push("production Compose must not include compose-dashboard");
  }

  const requiredServices = ["ai", "backend", "cloudsql-proxy", "frontend"];
  for (const serviceName of requiredServices) {
    if (!services[serviceName]) {
      errors.push(`${serviceName} service is required`);
    }
  }

  const backend = asObject(services.backend);
  const frontend = asObject(services.frontend);
  const ai = asObject(services.ai);
  const cloudSqlProxy = asObject(services["cloudsql-proxy"]);
  const backendEnv = serviceEnv(backend);
  const frontendEnv = serviceEnv(frontend);

  for (const [serviceName, service] of Object.entries(services)) {
    const env = serviceEnv(asObject(service));
    for (const [name, value] of Object.entries(env)) {
      if (name.startsWith("OTEL_EXPORTER_OTLP") && String(value).includes("compose-dashboard")) {
        errors.push(`${serviceName} must not wire production telemetry to compose-dashboard`);
      }
    }
  }

  const ingressServices = Object.entries(services)
    .filter(([, service]) => asStringList(asObject(service).ports).length > 0)
    .map(([name]) => name);
  if (ingressServices.length !== 1 || ingressServices[0] !== "frontend") {
    errors.push("frontend must be the only service with published ports for Cloud Run ingress");
  }

  if (servicePorts(backend).some((port) => port.includes("8080"))) {
    errors.push("backend must not bind or expose the Cloud Run ingress port 8080");
  }
  if (!servicePorts(frontend).some((port) => port.includes("8080"))) {
    errors.push("frontend must publish Cloud Run ingress port 8080");
  }
  if (frontendEnv.PORT) {
    errors.push("production frontend must not set Cloud Run reserved PORT env");
  }
  if (frontendEnv.VITE_BACKEND_URL) {
    errors.push("production frontend must use nginx BACKEND_URL instead of Vite dev proxy env");
  }
  const backendPort = backendEnv.PORT ?? "8081";
  if (frontendEnv.BACKEND_URL !== `127.0.0.1:${backendPort}`) {
    errors.push(
      "production frontend BACKEND_URL must target the backend via shared loopback (127.0.0.1:<port>)",
    );
  }

  if (
    !isParameterReference(backendEnv.DATABASE_URL, ["DATABASEURL", "DATABASE_URL"]) &&
    !String(backendEnv.DATABASE_URL ?? "").includes("127.0.0.1:5432")
  ) {
    errors.push("backend DATABASE_URL must come from a parameter/env value for Cloud SQL proxy localhost");
  }
  if (backendEnv.GCS_CREDENTIALS_JSON) {
    errors.push("backend must not set GCS_CREDENTIALS_JSON in production — use Cloud Run ADC instead");
  }
  if (!isParameterReference(backendEnv.GCS_BUCKET, ["GCSBUCKET", "GCS_BUCKET"])) {
    errors.push("backend GCS_BUCKET must come from a parameter/env value");
  }

  if (hasDependency(backend, "db")) {
    errors.push("backend must not depend on local db in production");
  }
  if (!hasDependency(backend, "ai")) {
    errors.push("backend must depend on ai");
  }
  if (!hasDependency(backend, "cloudsql-proxy")) {
    errors.push("backend must depend on cloudsql-proxy");
  }
  if (!hasDependency(frontend, "backend")) {
    errors.push("frontend must depend on backend");
  }

  const proxyImage = cloudSqlProxy.image;
  if (proxyImage !== "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0") {
    errors.push("cloudsql-proxy must use gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0");
  }
  const proxyCommand = asStringList(cloudSqlProxy.command ?? cloudSqlProxy.args);
  if (
    !proxyCommand.includes("thethinker:us-central1:thethinker-db") &&
    !proxyCommand.some(
      (arg) =>
        isParameterReference(arg, ["CLOUDSQLINSTANCE", "CLOUD_SQL_INSTANCE"]) ||
        isCloudSqlConnectionName(arg),
    )
  ) {
    errors.push("cloudsql-proxy must target the configured Cloud SQL instance");
  }

  for (const serviceName of ["ai", "backend", "frontend"]) {
    if (!imageUsesTag(asObject(services[serviceName]).image, imageTag)) {
      errors.push(`${serviceName} image must point to Artifact Registry and include the deployment tag`);
    }
  }

  return { errors };
}

function parseArgs(argv) {
  const args = { filePath: "aspire-output/docker-compose.yaml", imageTag: undefined };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--image-tag") {
      args.imageTag = argv[i + 1];
      i += 1;
    } else {
      args.filePath = arg;
    }
  }
  return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { filePath, imageTag } = parseArgs(process.argv);
  const { errors } = await validateProductionCompose(filePath, { imageTag });
  if (errors.length) {
    console.error(`Production Compose validation failed for ${filePath}:`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log(`Production Compose validation passed for ${filePath}.`);
}
