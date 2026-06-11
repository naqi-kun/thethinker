// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { createBuilder } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

// PostgreSQL with persistent lifetime and named data volume
const pgServer = await builder.addPostgres('db');
await pgServer.withDataVolume({ name: 'thethinker-pgdata' });
await pgServer.withPersistentLifetime();
const db = await pgServer.addDatabase('thethinker');
const dbUri = await db.uriExpression();

// JWT signing secret — Aspire prompts once on first start
const jwtSecret = builder.addParameter('jwtSecret', { secret: true });

// Anthropic API key for the AI stylist engine — Aspire prompts once on first start
const anthropicApiKey = builder.addParameter('anthropicApiKey', { secret: true });

// Local Google Cloud Storage emulator (fake-gcs-server) — gives the wardrobe
// image-upload feature a closed loop under `aspire run`, with no cloud creds.
// Published on a fixed host port so both the backend process and the browser
// (which loads image URLs directly) can reach it at localhost:4443.
const gcs = await builder.addContainer('gcs', 'fsouza/fake-gcs-server:1.49');
await gcs.withArgs(['-scheme', 'http', '-port', '4443', '-backend', 'filesystem']);
await gcs.withVolume('/storage', { name: 'thethinker-gcsdata' });
// Bind directly to the host port (no DCP proxy) so the fixed localhost:4443
// works for both the backend process and the browser loading image URLs.
await gcs.withHttpEndpoint({ port: 4443, targetPort: 4443, isProxied: false });

// Jaeger for distributed tracing (UI on 16686, OTLP HTTP on 4318)
const jaeger = await builder.addContainer('jaeger', { image: 'jaegertracing/all-in-one', tag: '1.57' });
await jaeger.withHttpEndpoint({ port: 16686, targetPort: 16686, name: 'ui' });
await jaeger.withHttpEndpoint({ port: 4318, targetPort: 4318, name: 'otlp' });

// Google API key for Gemini 2.5 Flash — Aspire prompts once on first start
const googleApiKey = builder.addParameter('googleApiKey', { secret: true });

// Python AI classification service — built from ./ai/Dockerfile
const ai = await builder.addDockerfile('ai', './ai');
await ai.withHttpEndpoint({ port: 8001, targetPort: 8001, name: 'http' });
await ai.withEnvironment('ANTHROPIC_API_KEY', anthropicApiKey);
await ai.withEnvironment('GOOGLE_API_KEY', googleApiKey);

// Go backend — runs `go run ./cmd/api` from ./backend
// Port is pinned to 8080 so the Seed Dev Data dashboard command can reach it at a known address.
const backend = await builder.addGoApp('backend', './backend', { packagePath: './cmd/api' });
await backend.withHttpEndpoint({ env: 'PORT', port: 8080 });
await backend.withEnvironment('DATABASE_URL', dbUri);
await backend.withEnvironment('JWT_SECRET', jwtSecret);
await backend.withEnvironment('AI_SERVICE_URL', ai.getEndpoint('http'));
await backend.withEnvironment('OTEL_EXPORTER_OTLP_ENDPOINT', jaeger.getEndpoint('otlp'));
await backend.withEnvironment('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/protobuf');
await backend.withEnvironment('OTEL_SERVICE_NAME', 'thethinker-api');
await backend.withEnvironment('OTEL_BSP_EXPORT_TIMEOUT', '60000');
// Image storage → local GCS emulator (host:port form, the client adds the scheme).
await backend.withEnvironment('GCS_BUCKET', 'wardrobe-images');
await backend.withEnvironment('GCS_EMULATOR_HOST', 'localhost:4443');
await backend.waitFor(db);
await backend.waitFor(gcs);
await backend.waitFor(ai);
await backend.waitFor(jaeger);

// Dashboard button on the db resource: click "Seed Dev Data" to reset the DB
// and preload GCS with real clothing images.
await pgServer.withCommand(
  'seed',
  'Seed Dev Data',
  async (_ctx) => {
    try {
      const res = await fetch('http://localhost:8080/dev/seed', { method: 'POST' });
      const text = await res.text();
      if (!res.ok) {
        return { success: false, errorMessage: text };
      }
      return { success: true, message: text.trim() };
    } catch (err) {
      return { success: false, errorMessage: String(err) };
    }
  },
  {
    commandOptions: {
      description: 'Truncate and re-populate the DB with test users and wardrobe items (dev only).',
      confirmationMessage: 'This will DELETE all existing wardrobe data and re-seed from scratch.\n\nTwo test accounts will be created:\n  dev@thethinker.com  /  password123\n  jane@thethinker.com /  password123\n\nContinue?',
      isHighlighted: true,
      iconName: 'DatabaseArrowRight',
    },
  },
);

// React + Vite frontend — VITE_BACKEND_URL drives the dev-server proxy target
const frontend = await builder.addViteApp('frontend', './frontend');
await frontend.withNpm();
await frontend.withHttpEndpoint({ env: 'PORT' });
await frontend.withEnvironment('VITE_BACKEND_URL', backend.getEndpoint('http'));
await frontend.withExternalHttpEndpoints();
await frontend.waitFor(backend);

// Docker Compose publish target — `aspire publish` generates docker-compose.yaml
await builder.addDockerComposeEnvironment('compose');

await builder.build().run();
