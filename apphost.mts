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

// Go backend — runs `go run ./cmd/api` from ./backend
const backend = await builder.addGoApp('backend', './backend', { packagePath: './cmd/api' });
await backend.withHttpEndpoint({ env: 'PORT' });
await backend.withEnvironment('DATABASE_URL', dbUri);
await backend.withEnvironment('JWT_SECRET', jwtSecret);
await backend.waitFor(db);

// React + Vite frontend — VITE_BACKEND_URL drives the dev-server proxy target
const frontend = await builder.addViteApp('frontend', './frontend');
await frontend.withNpm();
await frontend.withHttpEndpoint({ env: 'PORT' });
await frontend.withEnvironment('VITE_BACKEND_URL', backend.getEndpoint('http'));
await frontend.withExternalHttpEndpoints();
await frontend.waitFor(backend);

await builder.build().run();
