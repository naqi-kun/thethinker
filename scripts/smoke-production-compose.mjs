#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const composeFile = join(repoRoot, "aspire-output/docker-compose.yaml");
const localOverride = join(repoRoot, "docker-compose.local.yaml");
const envFile = join(repoRoot, "aspire-output/.env");

const LOG_SERVICES = ["backend", "cloudsql-proxy", "frontend"];

function parseArgs(argv) {
  return { down: argv.includes("--down") };
}

function dockerComposeArgs(...subcommand) {
  return [
    "compose",
    "-f",
    composeFile,
    "-f",
    localOverride,
    "--env-file",
    envFile,
    ...subcommand,
  ];
}

function runDockerCompose(...subcommand) {
  const keyFile =
    process.env.LOCAL_GCP_KEY_FILE ??
    join(repoRoot, ".local/thethinker-backend-key.json");
  if (!existsSync(keyFile)) {
    fail(
      `GCP key file not found: ${keyFile}\n` +
        "Set LOCAL_GCP_KEY_FILE or place key at .local/thethinker-backend-key.json",
    );
  }

  const imageTag = process.env.IMAGE_TAG ?? process.env.CI_COMMIT_TAG ?? "latest";
  const registry =
    process.env.REGISTRY ??
    "us-central1-docker.pkg.dev/thethinker/cloud-run-source-deploy";
  const composeEnv = {
    ...process.env,
    LOCAL_GCP_KEY_FILE: keyFile,
    AI_IMAGE:
      process.env.AI_IMAGE ?? `${registry}/thethinker-ai:${imageTag}`,
    BACKEND_IMAGE:
      process.env.BACKEND_IMAGE ?? `${registry}/thethinker-backend:${imageTag}`,
    FRONTEND_IMAGE:
      process.env.FRONTEND_IMAGE ?? `${registry}/thethinker-frontend:${imageTag}`,
    DB_PASSWORD: process.env.DB_PASSWORD ?? process.env.Parameters__dbPassword,
  };

  return spawnSync("docker", dockerComposeArgs(...subcommand), {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    env: composeEnv,
  });
}

function printLogHints() {
  console.error("\nInspect service logs:");
  const files = "-f aspire-output/docker-compose.yaml -f docker-compose.local.yaml";
  for (const service of LOG_SERVICES) {
    console.error(
      `  docker compose ${files} --env-file aspire-output/.env logs ${service}`,
    );
  }
}

function fail(message) {
  console.error(message);
  printLogHints();
  process.exit(1);
}

function assertArtifacts() {
  if (!existsSync(composeFile)) {
    console.error(
      `Missing ${composeFile}\n` +
        "Run: aspire publish -o ./aspire-output --environment production --non-interactive",
    );
    process.exit(1);
  }
  if (!existsSync(envFile)) {
    console.error(
      `Missing ${envFile}\n` +
        "Regenerate with aspire publish. Set Parameters__* / DB_PASSWORD before publishing.",
    );
    process.exit(1);
  }
  if (!existsSync(localOverride)) {
    console.error(`Missing ${localOverride}`);
    process.exit(1);
  }
}

function maybeValidate() {
  const imageTag = process.env.IMAGE_TAG ?? process.env.CI_COMMIT_TAG;
  if (!imageTag) {
    console.log("IMAGE_TAG not set — skipping validate:production-compose.");
    return;
  }

  console.log(`Validating production compose (IMAGE_TAG=${imageTag})...`);
  const result = spawnSync(
    process.execPath,
    [
      join(repoRoot, "scripts/validate-production-compose.mjs"),
      composeFile,
      "--image-tag",
      imageTag,
    ],
    { cwd: repoRoot, encoding: "utf8", stdio: "pipe" },
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function tearDown() {
  console.log("Tearing down production compose stack...");
  const result = runDockerCompose("down", "--remove-orphans");
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    fail("docker compose down failed.");
  }
  console.log("Stack removed.");
}

function bringUp() {
  console.log("Starting production compose stack (with local overrides)...");
  const result = runDockerCompose("up", "-d", "--wait");
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    fail("docker compose up failed. Check credentials, image tags, and Cloud SQL access.");
  }
}

function curlStatus(url, init = {}) {
  const args = ["-s", "-o", "/dev/null", "-w", "%{http_code}"];
  if (init.method) {
    args.push("-X", init.method);
  }
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (init.body) {
    args.push("-d", init.body);
  }
  args.push(url);

  const result = spawnSync("curl", args, { encoding: "utf8" });
  if (result.error) {
    fail(`curl failed: ${result.error.message}`);
  }
  return { status: result.status, code: result.stdout?.trim() };
}

function sleepMs(ms) {
  spawnSync("sleep", [String(Math.ceil(ms / 1000))]);
}

function waitForBackend(maxAttempts = 60, intervalMs = 1000) {
  console.log("Waiting for backend API (via nginx) ...");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const login = curlStatus("http://localhost:8080/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@example.com",
        password: "wrong-password",
      }),
    });
    if (login.code === "401") {
      return;
    }
    if (attempt < maxAttempts) {
      sleepMs(intervalMs);
    }
  }
  fail(
    "Backend did not become ready within timeout. " +
      "Cloud SQL proxy + migrations can take up to ~60s on cold start.",
  );
}

function runSmokeChecks() {
  console.log("Smoke: GET http://localhost:8080/ ...");
  const home = curlStatus("http://localhost:8080/");
  if (home.status !== 0 || home.code !== "200") {
    fail(`Expected GET / → 200, got ${home.code ?? "curl error"}.`);
  }

  waitForBackend();

  console.log("Smoke: POST http://localhost:8080/api/auth/login (bad creds) ...");
  const login = curlStatus("http://localhost:8080/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "nobody@example.com",
      password: "wrong-password",
    }),
  });
  if (login.status !== 0 || login.code !== "401") {
    fail(
      `Expected POST /api/auth/login → 401 (API reachable through nginx), got ${login.code ?? "curl error"}. ` +
        "502 usually means nginx cannot reach the backend.",
    );
  }

  console.log("Production compose smoke passed.");
}

const { down } = parseArgs(process.argv);

assertArtifacts();

if (down) {
  tearDown();
  process.exit(0);
}

maybeValidate();
bringUp();
runSmokeChecks();
