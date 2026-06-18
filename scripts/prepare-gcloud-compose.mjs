import { readFileSync, writeFileSync } from "fs";

// 1. Read and parse .env file
const envContent = readFileSync(".env", "utf8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const equalIdx = trimmed.indexOf("=");
  if (equalIdx > 0) {
    const key = trimmed.substring(0, equalIdx).trim();
    const val = trimmed.substring(equalIdx + 1).trim();
    envVars[key] = val;
  }
});

// For any parameter that might be missing, set a fallback
envVars["AI_IMAGE"] = envVars["AI_IMAGE"] || "thethinker-ai:latest";
envVars["BACKEND_IMAGE"] = envVars["BACKEND_IMAGE"] || "thethinker-backend:latest";
envVars["FRONTEND_IMAGE"] = envVars["FRONTEND_IMAGE"] || "thethinker-frontend:latest";

// 2. Read compose.yaml
let composeContent = readFileSync("compose.yaml", "utf8");

// 3. Replace environment variables
for (const [key, val] of Object.entries(envVars)) {
  // Replace both ${VAR} and ${VAR} patterns
  const regex = new RegExp(`\\$\\{${key}\\}`, "g");
  composeContent = composeContent.replace(regex, val);
}

// 4. Add 'build' directives to the services so Cloud Run can build them from local source
// Find the service blocks and append build properties
composeContent = composeContent.replace(
  "  ai:\n    image:",
  "  ai:\n    build: ./ai\n    image:"
);
composeContent = composeContent.replace(
  "  backend:\n    image:",
  "  backend:\n    build: ./backend\n    image:"
);
composeContent = composeContent.replace(
  "  frontend:\n    image:",
  "  frontend:\n    build: ./frontend\n    image:"
);

// 5. Write back to compose.yaml
writeFileSync("compose.yaml", composeContent);
console.log("Successfully prepared compose.yaml for gcloud run compose up!");
