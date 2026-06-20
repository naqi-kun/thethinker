import { EndpointProperty } from "../.aspire/modules/aspire.mjs";
import type {
  DistributedApplicationBuilder,
  GoAppResource,
  ParameterResourcePromise,
} from "../.aspire/modules/aspire.mjs";

export type ConfigureFrontendOptions = {
  builder: DistributedApplicationBuilder;
  backend: GoAppResource;
  googleClientId: ParameterResourcePromise;
  imageTag: string;
  artifactImage: (name: "ai" | "backend" | "frontend") => string;
};

export async function configureDevFrontend(
  options: ConfigureFrontendOptions,
): Promise<void> {
  const { builder, backend, googleClientId } = options;

  await builder
    .addViteApp("frontend", "./frontend")
    .withNpm()
    .withHttpEndpoint({
      port: 5173,
      targetPort: 5173,
      isProxied: false,
      env: "PORT",
    })
    .withEnvironment("VITE_BACKEND_URL", backend.getEndpoint("http"))
    .withEnvironment("VITE_GOOGLE_CLIENT_ID", googleClientId)
    .withExternalHttpEndpoints()
    .waitFor(backend);
}

export async function configurePublishFrontend(
  options: ConfigureFrontendOptions,
): Promise<void> {
  const { builder, backend, googleClientId, imageTag, artifactImage } = options;

  await builder
    .addDockerfile("frontend", "./frontend")
    .withBuildArg("VITE_GOOGLE_CLIENT_ID", googleClientId)
    .withHttpEndpoint({ port: 8080, targetPort: 8080, env: "PORT" })
    .withEnvironment(
      "BACKEND_URL",
      backend.getEndpoint("http").property(EndpointProperty.HostAndPort),
    )
    .withEnvironment("NODE_ENV", "production")
    .withExternalHttpEndpoints()
    .waitFor(backend)
    .withRemoteImageName(artifactImage("frontend"))
    .withRemoteImageTag(imageTag);
}

export async function configureFrontend(
  builder: DistributedApplicationBuilder,
  isPublish: boolean,
  options: ConfigureFrontendOptions,
): Promise<void> {
  if (isPublish) {
    await configurePublishFrontend(options);
    return;
  }
  await configureDevFrontend(options);
}
