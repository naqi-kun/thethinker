import type {
  ContainerResource,
  DistributedApplicationBuilder,
} from "../.aspire/modules/aspire.mjs";

export type DevStorageWiring = {
  mode: "dev";
  emulator: ContainerResource;
};

export type PublishStorageWiring = {
  mode: "publish";
};

export type StorageWiring = DevStorageWiring | PublishStorageWiring;

export async function configureDevStorage(
  builder: DistributedApplicationBuilder,
): Promise<DevStorageWiring> {
  const emulator = await builder
    .addContainer("gcs", "fsouza/fake-gcs-server:1.49")
    .withArgs(["-scheme", "http", "-port", "4443", "-backend", "filesystem"])
    .withVolume("/storage", { name: "thethinker-gcsdata" })
    .withHttpEndpoint({ port: 4443, targetPort: 4443, isProxied: false });

  return {
    mode: "dev",
    emulator,
  };
}

export function configurePublishStorage(): PublishStorageWiring {
  return { mode: "publish" };
}

export async function configureStorage(
  builder: DistributedApplicationBuilder,
  isPublish: boolean,
): Promise<StorageWiring> {
  if (isPublish) {
    return configurePublishStorage();
  }
  return configureDevStorage(builder);
}
