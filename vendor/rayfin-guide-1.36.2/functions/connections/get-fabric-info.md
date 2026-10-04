---
sidebar_position: 1
---

# Finding resource coordinates

Every connection recipe needs a real endpoint, such as the SQL server or the OneLake path.
This page explains **how to obtain those values from a Fabric item** so you (or an agent authoring a function) can fill them in with real data instead of guessing.

**You only need the workspace and item _display names_ to start** — for example, "lakehouseA in workspaceB".
Everything else (the workspace ID, item ID, SQL endpoint, OneLake path) is derivable from here.
Resolve those values rather than asking for anything you can look up.

> **Why this matters:** don't hardcode a guessed endpoint. `ctx.Tokens` gives you an access token, but you still have to point the SDK at the correct URL — and that URL comes from the Fabric item's metadata, not from `process.env`.

## Ways to get coordinates

| Source                      | Best for                                                   | Notes                                                                               |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Fabric CLI** (e.g. `fab`) | Anyone who already has a Fabric CLI installed              | Wraps the REST API below. If you're already using a Fabric CLI, reach for it first. |
| **Fabric MCP server**       | Agents running in an MCP-enabled environment               | If a Fabric MCP is configured, its tools wrap the same REST endpoints below.        |
| **Fabric REST API**         | Automation, agents, reproducible lookups; no extra tooling | Canonical source. Returns endpoints/paths directly. Covered below.                  |
| **Fabric portal**           | One-off manual lookups                                     | Open the item → **Settings** / **Connection strings** and copy the value.           |

If a Fabric CLI or MCP tool is already available, prefer it — it wraps the same REST endpoints. Otherwise call the REST API directly; the portal is the fallback for a quick manual copy. The rest of this page uses the REST API, since that is the source of truth every other option wraps.

## Calling the Fabric REST API

- **Base URL:** `https://api.fabric.microsoft.com/v1`
- **Token scope:** `https://api.fabric.microsoft.com/.default`
- **Auth header:** `Authorization: Bearer <token>`

Get a token at authoring time with the Azure CLI:

```bash
az account get-access-token \
  --resource https://api.fabric.microsoft.com \
  --query accessToken -o tsv
```

> This is an **authoring-time** lookup — you are gathering coordinates to write into the function. At **runtime** the function itself declares the audience on its `RayfinContext` annotation and reads `ctx.Tokens.<Audience>` (for the Fabric API specifically, `ctx.Tokens.Fabric` — see [Add a Fabric resource → Fabric REST API](./add-fabric-resource.md#fabric-rest-api)).

## Step 1 — find the workspace and item ID

List workspaces you can access:

```http
GET https://api.fabric.microsoft.com/v1/workspaces
```

List items of a given type in a workspace (to resolve a display name to its ID):

```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items?type=Lakehouse
```

`type` accepts any Fabric item type — for these recipes, use `Lakehouse`, `Warehouse`, or `SQLDatabase`.
Each entry returns `id`, `displayName`, and `type`. Take the `id` of the item you want.

## Step 2 — GET the item to read its coordinates

Each item type has a typed endpoint that returns the connection coordinates in its `properties` object.

### Lakehouse

```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}
```

```json
{
  "id": "5b218778-e7a5-4d73-8187-f10824047715",
  "type": "Lakehouse",
  "properties": {
    "oneLakeTablesPath": "https://onelake.dfs.fabric.microsoft.com/{workspaceId}/{itemId}/Tables",
    "oneLakeFilesPath": "https://onelake.dfs.fabric.microsoft.com/{workspaceId}/{itemId}/Files",
    "sqlEndpointProperties": {
      "connectionString": "xxxxx.datawarehouse.fabric.microsoft.com",
      "id": "37dc8a41-dea9-465d-b528-3e95043b2356",
      "provisioningStatus": "Success"
    }
  }
}
```

- **SQL analytics endpoint** → `properties.sqlEndpointProperties.connectionString` (the server for [SQL databases](./add-fabric-resource.md#sql-databases); use the lakehouse item GUID as `database`).
- **OneLake Files / Tables** → `properties.oneLakeFilesPath` / `oneLakeTablesPath` (the DFS URLs for [OneLake files](./add-fabric-resource.md#onelake-files)).

### Warehouse

```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/warehouses/{warehouseId}
```

```json
{
  "type": "Warehouse",
  "properties": {
    "connectionString": "xxxxx.datawarehouse.fabric.microsoft.com"
  }
}
```

- **SQL server** → `properties.connectionString`. Use with [SQL databases](./add-fabric-resource.md#sql-databases); the warehouse item GUID is the `database`.

### SQL Database

```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/sqlDatabases/{sqlDatabaseId}
```

```json
{
  "type": "SQLDatabase",
  "properties": {
    "connectionString": "Data Source=xxxxx.database.fabric.microsoft.com,1433;Initial Catalog=SQLDatabase1-<guid>;Encrypt=True;TrustServerCertificate=False",
    "databaseName": "SQLDatabase1-<guid>",
    "serverFqdn": "xxxxx.database.fabric.microsoft.com,1433"
  }
}
```

- **Server** → `properties.serverFqdn`, **database** → `properties.databaseName`. Both are also embedded in `properties.connectionString`.

## Coordinate lookup table

| You need                       | Item type    | Endpoint                | Field                                               |
| ------------------------------ | ------------ | ----------------------- | --------------------------------------------------- |
| SQL server (Lakehouse)         | Lakehouse    | `.../lakehouses/{id}`   | `properties.sqlEndpointProperties.connectionString` |
| SQL server (Warehouse)         | Warehouse    | `.../warehouses/{id}`   | `properties.connectionString`                       |
| SQL server + database (SQL DB) | SQL Database | `.../sqlDatabases/{id}` | `properties.serverFqdn` / `properties.databaseName` |
| OneLake Files / Tables URL     | Lakehouse    | `.../lakehouses/{id}`   | `properties.oneLakeFilesPath` / `oneLakeTablesPath` |
| Item GUID (any item)           | any          | `.../items?type={Type}` | `id`                                                |

For item types not listed here, browse the [Fabric REST API item reference](https://learn.microsoft.com/en-us/rest/api/fabric/) — each item's **Get** operation returns its coordinates under `properties`.

## Notes

- **OneLake paths are constructable.** Every OneLake path follows `https://onelake.dfs.fabric.microsoft.com/{workspaceId}/{itemId}/Files/...` — if you already have the workspace and item GUIDs you can build the URL without a lookup.
- **The item GUID is the `database` for SQL.** Fabric Lakehouse/Warehouse queries route by item GUID, not display name — see [SQL databases](./add-fabric-resource.md#sql-databases).
- **Read permission required.** The `Get` endpoints need `Item.Read.All` (or the item-specific read scope) on the delegated token. If a lookup 403s, the signed-in user lacks read access to that item.
