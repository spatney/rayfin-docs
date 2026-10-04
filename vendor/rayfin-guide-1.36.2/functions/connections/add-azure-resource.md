---
sidebar_position: 3
---

# Add an Azure resource

Connect a deployed function to **Azure Blob Storage**.

Grant the [application identity](../index.md#application-authentication) the storage data permissions required by your operations.

The storage account is an Azure resource, not a Fabric item, so its endpoint comes from the **Azure portal** (there is no Fabric lookup).
The pattern declares the audience in the `RayfinContext` annotation, reads the token from `ctx.Tokens`, and wraps it with the [`ContextTokenCredential`](./index.md#wrapping-the-token-for-azure-sdk-clients) helper for the Azure SDK.
See [Connecting to external resources](./index.md) for the shared model.

`AppSchema` below is your app's data schema — the same type you pass to `RayfinClient<AppSchema>`.
See [Writing functions](../writing-functions.md#accessing-data-and-request-context).

## Blob Storage

Connect to Azure Blob / Table / Queue storage using `AudienceType.Storage`:

```bash
cd rayfin/functions
npm install @azure/storage-blob @azure/identity
```

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";
import { BlobServiceClient } from "@azure/storage-blob";

const udf = new UserDataFunctions();

udf.func(
  "listBlobs",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Storage>,
    accountUrl: string,
  ): Promise<string[]> => {
    const credential = new ContextTokenCredential(ctx.Tokens.Storage);
    const service = new BlobServiceClient(accountUrl, credential);
    const names: string[] = [];
    for await (const container of service.listContainers()) {
      names.push(container.name);
    }
    return names;
  },
  [],
);
```

Provide the storage account URL (e.g. `https://<account>.blob.core.windows.net`).

> `AudienceType.Storage` also covers **OneLake** files — that Fabric case is documented in [Add a Fabric resource → OneLake files](./add-fabric-resource.md#onelake-files).
