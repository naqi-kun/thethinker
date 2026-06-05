// Aspire TypeScript AppHost
// For more information, see: https://aspire.dev

import { createBuilder, OtlpProtocol } from './.aspire/modules/aspire.mjs';

const builder = await createBuilder();

// PostgreSQL with persistent lifetime and named data volume
const pgServer = await builder.addPostgres('db');
await pgServer.withDataVolume({ name: 'thethinker-pgdata' });
await pgServer.withPersistentLifetime();
const db = await pgServer.addDatabase('thethinker');
const dbUri = await db.uriExpression();

// JWT signing secret — Aspire prompts once on first start
const jwtSecret = builder.addParameter('jwtSecret', { secret: true });

// Local Google Cloud Storage emulator (fake-gcs-server) — gives the wardrobe
// image-upload feature a closed loop under `aspire run`, with no cloud creds.
// Published on a fixed host port so both the backend process and the browser
// (which loads image URLs directly) can reach it at localhost:4443.
const gcs = await builder.addContainer('gcs', 'fsouza/fake-gcs-server:1.49');
await gcs.withArgs(['-scheme', 'http', '-port', '4443', '-backend', 'memory']);
// Bind directly to the host port (no DCP proxy) so the fixed localhost:4443
// works for both the backend process and the browser loading image URLs.
await gcs.withHttpEndpoint({ port: 4443, targetPort: 4443, isProxied: false });

// Go backend — runs `go run ./cmd/api` from ./backend
const backend = await builder.addGoApp('backend', './backend', { packagePath: './cmd/api' });
await backend.withHttpEndpoint({ env: 'PORT' });
await backend.withEnvironment('DATABASE_URL', dbUri);
await backend.withEnvironment('JWT_SECRET', jwtSecret);
await backend.withOtlpExporter({ protocol: OtlpProtocol.Grpc });
await backend.withEnvironment('OTEL_BSP_EXPORT_TIMEOUT', '60000');
// Image storage → local GCS emulator (host:port form, the client adds the scheme).
await backend.withEnvironment('GCS_BUCKET', 'wardrobe-images');
await backend.withEnvironment('GCS_EMULATOR_HOST', 'localhost:4443');
// The AI classifier service isn't wired into Aspire yet; this placeholder keeps
// the backend booting so the image-upload loop is testable. /wardrobe/scan needs
// a real classifier and will error until that service is added to the AppHost.
await backend.withEnvironment('AI_SERVICE_URL', 'http://localhost:8001');
await backend.waitFor(db);
await backend.waitFor(gcs);

// React + Vite frontend — VITE_BACKEND_URL drives the dev-server proxy target
const frontend = await builder.addViteApp('frontend', './frontend');
await frontend.withNpm();
await frontend.withHttpEndpoint({ env: 'PORT' });
await frontend.withEnvironment('VITE_BACKEND_URL', backend.getEndpoint('http'));
await frontend.withExternalHttpEndpoints();
await frontend.waitFor(backend);

await builder.build().run();
