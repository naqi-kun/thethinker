import type { ReferenceExpression } from "../.aspire/modules/base.mjs";
import type { Awaitable } from "../.aspire/modules/base.mjs";
import { refExpr } from "../.aspire/modules/base.mjs";
import type {
  ContainerResource,
  DistributedApplicationBuilder,
  GoAppResource,
  ParameterResource,
  PostgresDatabaseResource,
} from "../.aspire/modules/aspire.mjs";

export type DatabaseUrl = Awaitable<ParameterResource> | ReferenceExpression;

export type DevDatabaseWiring = {
  mode: "dev";
  url: DatabaseUrl;
  dependency: PostgresDatabaseResource;
};

export type PublishDatabaseWiring = {
  mode: "publish";
  url: DatabaseUrl;
  dependency: ContainerResource;
};

export type DatabaseWiring = DevDatabaseWiring | PublishDatabaseWiring;

export type ConfigureDatabaseOptions = {
  builder: DistributedApplicationBuilder;
  isPublish: boolean;
  cloudSqlProxyImage: string;
  resolveCloudSqlInstance: () => string;
};

export async function configureDevDatabase(
  builder: DistributedApplicationBuilder,
): Promise<DevDatabaseWiring> {
  const pgServer = await builder
    .addPostgres("db")
    .withDataVolume({ name: "thethinker-pgdata" })
    .withPersistentLifetime()
    .addDatabase("thethinker");

  const url = await pgServer.uriExpression();

  return {
    mode: "dev",
    url,
    dependency: pgServer,
  };
}

export async function configurePublishDatabase(
  options: Pick<
    ConfigureDatabaseOptions,
    "builder" | "cloudSqlProxyImage" | "resolveCloudSqlInstance"
  >,
): Promise<PublishDatabaseWiring> {
  const { builder, cloudSqlProxyImage, resolveCloudSqlInstance } = options;

  let url: DatabaseUrl = builder.addParameter("databaseUrl", { secret: true });
  if (!process.env.Parameters__databaseUrl) {
    const dbPassword = await builder.addParameter("dbPassword", {
      secret: true,
    });
    url = refExpr`postgresql://postgres:${dbPassword}@127.0.0.1:5432/thethinker`;
  }

  const cloudSqlProxy = await builder
    .addContainer("cloudsql-proxy", cloudSqlProxyImage)
    .withArgs(["--port=5432", "--address=0.0.0.0", resolveCloudSqlInstance()])
    .withHttpEndpoint({ port: 5432, targetPort: 5432, name: "tcp" });

  return {
    mode: "publish",
    url,
    dependency: cloudSqlProxy,
  };
}

export async function configureDatabase(
  options: ConfigureDatabaseOptions,
): Promise<DatabaseWiring> {
  if (options.isPublish) {
    return configurePublishDatabase(options);
  }
  return configureDevDatabase(options.builder);
}

export async function configureDevSeedCommand(
  devDatabase: DevDatabaseWiring,
  backend: GoAppResource,
): Promise<void> {
  await devDatabase.dependency.withCommand(
    "seed",
    "Seed Dev Data",
    async (_ctx) => {
      try {
        const backendUrl = await backend.getEndpoint("http").url();
        const res = await fetch(`${backendUrl}/dev/seed`, { method: "POST" });
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
}
