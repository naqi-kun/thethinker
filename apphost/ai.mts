import type {
  ContainerResource,
  DistributedApplicationBuilder,
  ParameterResourcePromise,
} from "../.aspire/modules/aspire.mjs";

export type ConfigureAiOptions = {
  builder: DistributedApplicationBuilder;
  anthropicApiKey: ParameterResourcePromise;
  imageTag: string;
  artifactImage: (name: "ai" | "backend" | "frontend") => string;
};

export async function configureAi(
  options: ConfigureAiOptions,
): Promise<ContainerResource> {
  const { builder, anthropicApiKey, imageTag, artifactImage } = options;

  return builder
    .addDockerfile("ai", "./ai")
    .withHttpEndpoint({ port: 8001, targetPort: 8001, name: "http" })
    .withEnvironment("ANTHROPIC_API_KEY", anthropicApiKey)
    .withRemoteImageName(artifactImage("ai"))
    .withRemoteImageTag(imageTag);
}
