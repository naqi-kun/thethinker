import type {
  ContainerResource,
  DistributedApplicationBuilder,
  GoAppResource,
  ParameterResourcePromise,
} from "../.aspire/modules/aspire.mjs";
import type { DatabaseWiring } from "./database.mjs";
import type { StorageWiring } from "./storage.mjs";

export type ConfigureBackendOptions = {
  builder: DistributedApplicationBuilder;
  database: DatabaseWiring;
  storage: StorageWiring;
  ai: ContainerResource;
  dbUri: DatabaseWiring["url"];
  jwtSecret: ParameterResourcePromise;
  gcsBucket: ParameterResourcePromise;
  weatherApiKey: ParameterResourcePromise;
  googleClientId: ParameterResourcePromise;
  googleClientSecret: ParameterResourcePromise;
  imageTag: string;
  artifactImage: (name: "ai" | "backend" | "frontend") => string;
};

export async function configureBackend(
  options: ConfigureBackendOptions,
): Promise<GoAppResource> {
  const {
    builder,
    database,
    storage,
    ai,
    dbUri,
    jwtSecret,
    gcsBucket,
    weatherApiKey,
    googleClientId,
    googleClientSecret,
    imageTag,
    artifactImage,
  } = options;

  let backendBuilder = builder
    .addGoApp("backend", "./backend", { packagePath: "./cmd/api" })
    .withHttpEndpoint({
      port: 8081,
      targetPort: 8081,
      isProxied: false,
      env: "PORT",
    })
    .withEnvironment("DATABASE_URL", dbUri)
    .withEnvironment("JWT_SECRET", jwtSecret)
    .withEnvironment("AI_SERVICE_URL", ai.getEndpoint("http"))
    .withEnvironment("OTEL_SERVICE_NAME", "thethinker-api")
    .withEnvironment("GCS_BUCKET", gcsBucket)
    .withEnvironment("WEATHER_API_KEY", weatherApiKey)
    .withEnvironment("GOOGLE_CLIENT_ID", googleClientId)
    .withEnvironment("GOOGLE_CLIENT_SECRET", googleClientSecret);

  if (storage.mode === "dev") {
    backendBuilder = backendBuilder
      .withEnvironment("GCS_EMULATOR_HOST", "localhost:4443")
      .waitFor(storage.emulator);
  }

  backendBuilder = backendBuilder.waitFor(database.dependency);

  return backendBuilder
    .waitFor(ai)
    .withRemoteImageName(artifactImage("backend"))
    .withRemoteImageTag(imageTag);
}
