import type { DistributedApplicationBuilder } from "../.aspire/modules/aspire.mjs";

export type ConfigurePublishComposeOptions = {
  builder: DistributedApplicationBuilder;
  isPublish: boolean;
  composeServiceName: string;
  aiListenPort: string;
  backendListenPort: string;
};

export async function configurePublishCompose(
  options: ConfigurePublishComposeOptions,
): Promise<void> {
  const {
    builder,
    isPublish,
    composeServiceName,
    aiListenPort,
    backendListenPort,
  } = options;

  const compose = await builder.addDockerComposeEnvironment("compose");
  await compose.configureComposeFile(async (composeFile) => {
    if (!isPublish) return;

    await composeFile.name.set(composeServiceName);
    await composeFile.services.remove("compose-dashboard");
    await composeFile.volumes.remove("thethinker-pgdata");

    for (const serviceName of ["ai", "backend", "frontend"]) {
      const service = await composeFile.services.get(serviceName);
      await service.environment.remove("OTEL_EXPORTER_OTLP_ENDPOINT");
      await service.environment.remove("OTEL_EXPORTER_OTLP_PROTOCOL");
    }

    const backendService = await composeFile.services.get("backend");
    await backendService.environment.remove("GCS_CREDENTIALS_JSON");
    await backendService.environment.set(
      "AI_SERVICE_URL",
      `http://127.0.0.1:${aiListenPort}`,
    );

    const frontendService = await composeFile.services.get("frontend");
    await frontendService.environment.remove("PORT");
    await frontendService.environment.set(
      "BACKEND_URL",
      `127.0.0.1:${backendListenPort}`,
    );
  });
}
