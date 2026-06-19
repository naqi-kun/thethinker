import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";

const keyPath = join(process.cwd(), "gcs-key.json");
const jsonPath = join(process.cwd(), "service-prod.json");

if (!existsSync(keyPath)) {
  console.error(`Error: GCS credentials file not found at: ${keyPath}`);
  process.exit(1);
}

console.log("Reading and minifying gcs-key.json...");
let gcsKeyContent;
try {
  const rawKey = readFileSync(keyPath, "utf8");
  gcsKeyContent = JSON.stringify(JSON.parse(rawKey));
} catch (err) {
  console.error("Failed to parse and minify gcs-key.json:", err.message);
  process.exit(1);
}

// Google OAuth client secret comes from the environment (a GitLab CI variable or
// your local shell), never committed. The public client ID is set inline below.
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!googleClientSecret) {
  console.error("Error: GOOGLE_CLIENT_SECRET env var not set (required for Google sign-in).");
  process.exit(1);
}

console.log("Querying the latest created Cloud Run revision name dynamically...");
const getLatestResult = spawnSync("gcloud", [
  "run", "services", "describe", "thethinker",
  "--project=thethinker",
  "--region=us-central1",
  "--format=value(status.latestCreatedRevisionName)"
], { encoding: "utf8" });

if (getLatestResult.status !== 0 || !getLatestResult.stdout.trim()) {
  console.error("Failed to fetch latest revision name:", getLatestResult.stderr);
  process.exit(1);
}

const latestRevisionName = getLatestResult.stdout.trim();
console.log(`Latest revision detected: ${latestRevisionName}`);

console.log(`Fetching service configuration from revision ${latestRevisionName}...`);
const getSvcResult = spawnSync("gcloud", [
  "run", "revisions", "describe", latestRevisionName,
  "--project=thethinker",
  "--region=us-central1",
  "--format=json"
], { encoding: "utf8" });

if (getSvcResult.status !== 0) {
  console.error("Failed to fetch revision config:", getSvcResult.stderr);
  process.exit(1);
}

let revision;
try {
  revision = JSON.parse(getSvcResult.stdout);
} catch (err) {
  console.error("Failed to parse revision config JSON:", err.message);
  process.exit(1);
}

console.log("Reconstructing Service configuration from the revision spec...");

// Define the clean Service schema
const service = {
  apiVersion: "serving.knative.dev/v1",
  kind: "Service",
  metadata: {
    name: "thethinker",
    labels: {
      "cloud.googleapis.com/location": "us-central1",
      "managed-by": "runcompose"
    },
    annotations: {
      "run.googleapis.com/ingress": "all",
      "run.googleapis.com/ingress-status": "all"
    }
  },
  spec: {
    template: {
      metadata: {
        labels: {
          "managed-by": "runcompose",
          "run.googleapis.com/startupProbeType": "Default"
        },
        annotations: {
          // Execution environment: gen2 (second generation)
          "run.googleapis.com/execution-environment": "gen2",
          "run.googleapis.com/startup-cpu-boost": "true",
          // Remove db dependency: backend depends on ai and cloudsql-proxy, frontend depends on backend
          "run.googleapis.com/container-dependencies": JSON.stringify({
            "backend": ["ai", "cloudsql-proxy"],
            "frontend": ["backend"]
          })
        }
      },
      spec: {
        containerConcurrency: revision.spec.containerConcurrency,
        serviceAccountName: revision.spec.serviceAccountName,
        timeoutSeconds: revision.spec.timeoutSeconds,
        containers: []
      }
    }
  }
};

// Copy and filter containers from the successful revision (excluding 'db')
for (const container of revision.spec.containers) {
  if (container.name === "db") {
    console.log("Removing 'db' PostgreSQL container from production spec...");
    continue; // Exclude local postgres container
  }

  if (container.name === "cloudsql-proxy") {
    console.log("Skipping existing 'cloudsql-proxy' (will be re-added fresh below)...");
    continue; // Always re-add from the fixed spec below to avoid duplicates
  }

  // Clone container spec
  const cleanContainer = {
    name: container.name,
    image: container.image,
    resources: JSON.parse(JSON.stringify(container.resources)), // deep-clone so we can patch limits
    startupProbe: container.startupProbe
  };

  // The AI sidecar loads CLIP + background-removal models simultaneously.
  // 1 GiB was too small — the instance OOM-killed on the first image upload.
  if (container.name === "ai") {
    console.log("Bumping 'ai' container memory limit to 2Gi...");
    if (!cleanContainer.resources) cleanContainer.resources = {};
    if (!cleanContainer.resources.limits) cleanContainer.resources.limits = {};
    cleanContainer.resources.limits.memory = "2Gi";
  }

  if (container.args) cleanContainer.args = container.args;
  if (container.ports) cleanContainer.ports = container.ports;

  // Clone environment variables
  cleanContainer.env = [];
  if (container.env) {
    for (const envVar of container.env) {
      cleanContainer.env.push({ name: envVar.name, value: envVar.value });
    }
  }

  // Inject production updates to backend container
  if (container.name === "backend") {
    console.log("Configuring production environment variables for 'backend'...");

    // PORT=8081 keeps the backend sidecar off the ingress port (8080) that Cloud Run
    // assigns to the frontend nginx container. Both containers share localhost in the
    // same Cloud Run network namespace, so they must listen on distinct ports.
    const prodEnv = {
      DATABASE_URL: "postgresql://postgres:TheThinker2026!@127.0.0.1:5432/thethinker",
      GCS_CREDENTIALS_JSON: gcsKeyContent,
      GCS_BUCKET: "thethinker-wardrobe-images",
      PORT: "8081",
      GOOGLE_CLIENT_ID: "176526137598-8hme48480tc0gajdttlrpv9qu4g9c7a7.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: googleClientSecret
    };

    for (const [key, val] of Object.entries(prodEnv)) {
      const existing = cleanContainer.env.find(e => e.name === key);
      if (existing) {
        existing.value = val;
      } else {
        cleanContainer.env.push({ name: key, value: val });
      }
    }
  }

  // Inject production updates to frontend container
  if (container.name === "frontend") {
    console.log("Configuring production environment variables for 'frontend'...");

    // BACKEND_URL tells nginx where to proxy /api/ requests. In Cloud Run
    // multi-container, all sidecars are reachable via 127.0.0.1 on their port.
    const frontendProdEnv = {
      BACKEND_URL: "127.0.0.1:8081"
    };

    for (const [key, val] of Object.entries(frontendProdEnv)) {
      const existing = cleanContainer.env.find(e => e.name === key);
      if (existing) {
        existing.value = val;
      } else {
        cleanContainer.env.push({ name: key, value: val });
      }
    }
  }

  service.spec.template.spec.containers.push(cleanContainer);
}

// Add Cloud SQL Auth Proxy sidecar container (v2)
console.log("Adding 'cloudsql-proxy' sidecar container...");
const proxyContainer = {
  name: "cloudsql-proxy",
  image: "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.0",
  args: [
    "--port=5432",
    "--address=0.0.0.0",
    "thethinker:us-central1:thethinker-db"
  ],
  resources: {
    limits: {
      cpu: "500m",
      memory: "512Mi"
    }
  },
  startupProbe: {
    failureThreshold: 3,
    periodSeconds: 10,
    tcpSocket: {
      port: 5432
    },
    timeoutSeconds: 5
  }
};
service.spec.template.spec.containers.push(proxyContainer);

// Write the reconstructed declarative configuration to a temporary JSON file
console.log("Writing temporary service-prod.json...");
try {
  writeFileSync(jsonPath, JSON.stringify(service, null, 2), "utf8");
} catch (err) {
  console.error("Failed to write temporary JSON config:", err.message);
  process.exit(1);
}

// Apply the configuration via gcloud run services replace
console.log("Applying atomic Production-ready configuration via 'gcloud run services replace'...");
const replaceResult = spawnSync("gcloud", [
  "run", "services", "replace", jsonPath,
  "--project=thethinker",
  "--region=us-central1"
], { encoding: "utf8" });

// Clean up temporary file containing sensitive GCS private key
if (existsSync(jsonPath)) {
  console.log("Cleaning up temporary service-prod.json...");
  unlinkSync(jsonPath);
}

if (replaceResult.stdout) {
  console.log("STDOUT:\n", replaceResult.stdout);
}
if (replaceResult.stderr) {
  console.error("STDERR:\n", replaceResult.stderr);
}

if (replaceResult.status !== 0) {
  console.error(`gcloud replace command failed with exit code ${replaceResult.status}`);
  process.exit(replaceResult.status || 1);
}

console.log("\nSuccessfully deployed Production-ready Configuration atomically!");
