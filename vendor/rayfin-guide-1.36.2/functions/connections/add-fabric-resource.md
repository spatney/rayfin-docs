---
sidebar_position: 2
---

# Add a Fabric resource

Connect a deployed function to a **Microsoft Fabric item** — a Lakehouse, Warehouse, SQL Database, or OneLake files.

For the app's Rayfin DB, use [`ctx.getDataClient()`](../writing-functions.md#accessing-data-and-request-context) instead.

Grant the [application identity](../index.md#application-authentication) the required access to the workspace, item, or database for the operation you need.

**Before you start:** you need the item's coordinates (SQL endpoint or OneLake path).
See [Get Fabric info](./get-fabric-info.md) for how to pull them from the Fabric REST API.

All the patterns below follow the same model: declare the audience in the `RayfinContext` annotation, read the token from `ctx.Tokens`, use it. See [Connecting to external resources](./index.md) for the shared model and the [`ContextTokenCredential`](./index.md#wrapping-the-token-for-azure-sdk-clients) helper referenced here.

`AppSchema` below is your app's data schema — the same type you pass to `RayfinClient<AppSchema>`. See [Writing functions](../writing-functions.md#accessing-data-and-request-context).

## SQL databases

Covers Fabric **Lakehouse** (SQL analytics endpoint), **Warehouse**, **SQL Database**, and **Mirrored Database**, using `AudienceType.Sql`. The same `AudienceType.Sql` connection also works for **Azure SQL Database** — use the Azure SQL server FQDN as `server` and the database name as `database` (no item GUID).

- **Package:** `mssql@^12.6.0` (which pulls `tedious >= 19.2.2`). Older `tedious` (`<= 19.1.2`) has a LOGIN7 FeatureExt bug that causes "socket hang up" errors against Fabric endpoints.
- **Encryption:** `encrypt: true` (not `'strict'`). This matches ODBC `Encrypt=yes`.
- **Auth:** `azure-active-directory-access-token` with the token from `ctx.Tokens.Sql`.

Install the driver in the functions project:

```bash
cd rayfin/functions
npm install mssql@^12.6.0
```

| Resource               | What to pass as `server`                 | What to pass as `database`                 |
| ---------------------- | ---------------------------------------- | ------------------------------------------ |
| **Lakehouse**          | `sqlEndpointProperties.connectionString` | Item GUID (Initial Catalog — **required**) |
| **Warehouse**          | `properties.connectionString`            | Item GUID                                  |
| **SQL Database**       | `properties.serverFqdn`                  | `properties.databaseName`                  |
| **Mirrored Database**  | SQL analytics endpoint                   | Item GUID                                  |
| **Azure SQL Database** | Azure SQL server FQDN                    | Database name (no item GUID)               |

> **Important:** For Lakehouse, Warehouse, and Mirrored Database you **must** pass the item GUID as `database`. Without it, multi-item workspaces cannot route the query correctly. Get these values via [Get Fabric info](./get-fabric-info.md).

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";
import sql from "mssql";

const udf = new UserDataFunctions();

// Read these from the Fabric item — see "Get Fabric info".
const SQL_SERVER = "<endpoint>.datawarehouse.fabric.microsoft.com";
const DATABASE = "<item-guid-or-db-name>";

udf.func(
  "queryData",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Sql>,
    query: string,
  ): Promise<Record<string, unknown>[]> => {
    const token = ctx.Tokens.Sql;
    const pool = await sql.connect({
      server: SQL_SERVER,
      database: DATABASE,
      options: { encrypt: true, trustServerCertificate: false },
      authentication: {
        type: "azure-active-directory-access-token",
        options: { token },
      },
    });
    const result = await pool.request().query(query);
    await pool.close();
    return result.recordset;
  },
  [],
);
```

## OneLake files

Read and write files in a Lakehouse's OneLake storage using `AudienceType.Storage`.

The OneLake DFS URL has the form `https://onelake.dfs.fabric.microsoft.com/<workspaceId>/<itemId>/Files/<path>` — get it from `oneLakeFilesPath` via [Get Fabric info](./get-fabric-info.md#lakehouse), or construct it from the workspace and item GUIDs.

Call the DFS endpoint directly with the app-identity token — no SDK required:

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.func(
  "readFile",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Storage>,
    fileUrl: string,
  ): Promise<string> => {
    const token = ctx.Tokens.Storage;
    const res = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`OneLake read failed: ${res.status}`);
    }
    return await res.text();
  },
  [],
);
```

## Fabric REST API

Call the [Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/) as the app identity — for example to list items or read item metadata from inside a function — using `AudienceType.Fabric`.
Check that the specific API supports application identities and that the app identity has the required access.

The API base is fixed at `https://api.fabric.microsoft.com/v1`; `ctx.Tokens.Fabric` returns a token scoped for it. Send it as a bearer token with `fetch`:

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

const FABRIC_API = "https://api.fabric.microsoft.com/v1";

udf.func(
  "listWorkspaceItems",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Fabric>,
    workspaceId: string,
  ): Promise<unknown> => {
    const token = ctx.Tokens.Fabric;
    const res = await fetch(`${FABRIC_API}/workspaces/${workspaceId}/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Fabric API returned ${res.status}`);
    }
    return res.json();
  },
  [],
);
```

> This is the same API used in [Get Fabric info](./get-fabric-info.md) — the difference is that there you call it at **authoring time** (with an `az` token) to gather endpoints, whereas here the **deployed function** calls it at runtime with the app identity's token and resource permissions.
