// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { createBuilder } from "./.aspire/modules/aspire.mjs";

const builder = await createBuilder();

// PostgreSQL with persistent lifetime and named data volume
const pgServer = await builder.addPostgres("db");
await pgServer.withDataVolume({ name: "thethinker-pgdata" });
await pgServer.withPersistentLifetime();
const db = await pgServer.addDatabase("thethinker");
const dbUri = await db.uriExpression();

// JWT signing secret — Aspire prompts once on first start
const jwtSecret = builder.addParameter("jwtSecret", { secret: true });

// Anthropic API key for the AI stylist engine — Aspire prompts once on first start
const anthropicApiKey = builder.addParameter("anthropicApiKey", {
  secret: true,
});

// Local Google Cloud Storage emulator — dev only, excluded from `aspire publish`.
const isPublish = await builder.executionContext().isPublishMode();
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

// Google API key for Gemini 2.5 Flash — Aspire prompts once on first start
const googleApiKey = builder.addParameter("googleApiKey", { secret: true });

// OpenWeatherMap API key — optional. When absent the backend serves the
// last-known-good cached reading per location (within max-age) and otherwise
// omits weather entirely — no fabricated values. Supply a real key via the
// WEATHER_API_KEY env var (e.g. `$env:WEATHER_API_KEY = "..."; aspire run`) to
// get live weather. Get a free key at https://home.openweathermap.org/users/sign_up
const weatherApiKey = builder.addParameter("weatherApiKey", {
  secret: true,
  value: process.env.WEATHER_API_KEY ?? "",
});

// Python AI classification service — built from ./ai/Dockerfile
const ai = await builder.addDockerfile("ai", "./ai");
await ai.withHttpEndpoint({ port: 8001, targetPort: 8001, name: "http" });
await ai.withEnvironment("ANTHROPIC_API_KEY", anthropicApiKey);
await ai.withEnvironment("GOOGLE_API_KEY", googleApiKey);

// Go backend — runs `go run ./cmd/api` from ./backend
const backend = await builder.addGoApp("backend", "./backend", {
  packagePath: "./cmd/api",
});
await backend.withHttpEndpoint({ env: "PORT" });
await backend.withEnvironment("DATABASE_URL", dbUri);
await backend.withEnvironment("JWT_SECRET", jwtSecret);
await backend.withEnvironment("AI_SERVICE_URL", ai.getEndpoint("http"));
await backend.withEnvironment("OTEL_SERVICE_NAME", "thethinker-api");
// Image storage → local GCS emulator (host:port form, the client adds the scheme).
await backend.withEnvironment("GCS_BUCKET", "wardrobe-images");
if (!isPublish && gcs) {
  await backend.withEnvironment("GCS_EMULATOR_HOST", "localhost:4443");
  await backend.waitFor(gcs);
}
await backend.withEnvironment("WEATHER_API_KEY", weatherApiKey);
await backend.waitFor(db);
await backend.waitFor(ai);

// Dashboard button on the db resource: click "Seed Dev Data" to reset the DB
// and preload GCS with real clothing images.
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

// React + Vite frontend — VITE_BACKEND_URL drives the dev-server proxy target
const frontend = await builder.addViteApp("frontend", "./frontend");
await frontend.withNpm();
await frontend.withHttpEndpoint({ env: "PORT" });
await frontend.withEnvironment("VITE_BACKEND_URL", backend.getEndpoint("http"));
await frontend.withExternalHttpEndpoints();
await frontend.waitFor(backend);

// Docker Compose publish target — `aspire publish` generates docker-compose.yaml
await builder.addDockerComposeEnvironment("compose");

await builder.build().run();
