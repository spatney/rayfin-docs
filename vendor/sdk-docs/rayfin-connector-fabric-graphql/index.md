---
symbols: []
---

# @microsoft/rayfin-connector-fabric-graphql — Category A entity connectors

Category A connectors connect a Rayfin app to an **existing Fabric database** — a SQL Database, a Warehouse, or a Lakehouse SQL endpoint — and expose its tables as typed entities with read/create/update/delete and `@role` row-level security. Use them when the data already lives in a database and you want a typed client over it, not a new schema.

One connector type per source database:

- `fabric-sqldatabase` — Fabric SQL Database; writes return the full row.
- `fabric-warehouse` — Fabric Warehouse; writes return a status object, not the row.
- `fabric-sqlanalytics` — Lakehouse SQL endpoint, **read-only**.

For `kusto` and `fabric-semanticmodel`, use the Category B connectors instead — nothing here applies to them.

## Pages

- **This page** — generate entities after `connector add`, write the aggregate `schema.ts`, wire the client.
- [Entities](./entities.md) — `@role` scoping, row-level policies, the entity generation contract, and the `metadata.json` reference.
- [Querying](./querying.md) — reads, by-key lookups, related columns.
- [Mutations](./mutations.md) — `create` / `update` / `delete` and per-dialect return shapes.
- [Troubleshooting](./troubleshooting.md) — anti-patterns and a symptom to cause to fix table.

## After `connector add`, generate the entities

`rayfin connector add --type <type> --workspace-id <ws> --item-id <item> [--operations read,update]` writes `rayfin/connectors/<name>/metadata.json` and a placeholder `schema.ts`, then stops. It never emits entity files.

**Generating them is the immediate next step — do not wait for the user to ask.** A connector is not done until its entity files exist.

1. Read `metadata.json` (shape: `SchemaMetadata`).
2. Pick the tables in scope: all of `schemas[].tables[]`, or just the ones the user named.
3. For each, write `rayfin/connectors/<name>/<EntityName>.ts` per the [entity generation contract](./entities.md#entity-generation-contract).
4. Overwrite the placeholder `schema.ts` with the [aggregate schema](#aggregate-schema) below.
5. Surface every warning the contract emits (unknown SQL types, missing FK metadata).

Skip tables that already have a current `<EntityName>.ts`, and never overwrite an entity the user hand-edited without asking. To refresh after a source-schema change, re-run `connector remove` then `connector add` for fresh metadata, then regenerate.

## Install the packages

The aggregate `schema.ts` imports two packages a fresh app does not declare. `connector add` prints the exact `npm install` — run that. **Always pin the version** (connector packages ship in lockstep with the CLI; their npm `latest`/`preview` tags lag):

```bash
# Shape only — use the version connector add printed.
npm install @microsoft/rayfin-connector-fabric-graphql@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha
```

An unversioned install resolves to an older release that hard-pins its own `@microsoft/rayfin-data`, leaving two Rayfin versions in one app. Both imports are `import type`, but TypeScript still needs the packages present to compile.

## Aggregate schema

Overwrite the placeholder `rayfin/connectors/<name>/schema.ts` so it exports three things: each entity **class** re-exported, a `<Name>Schema` type, and a `connectorConfig` value.

```ts
// rayfin/connectors/inventory/schema.ts
import type { GraphQLBackedConnector } from '@microsoft/rayfin-connector-fabric-graphql';
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';

import { Order } from './Order.js';
import { Customer } from './Customer.js';

export { Order } from './Order.js';
export { Customer } from './Customer.js';

// `as const satisfies` (not `: ConnectorConfig`) so the connector and operations
// literals survive — the marker reads them for the CRUD verbs and the dialect.
export const connectorConfig = {
  connector: 'fabric-warehouse',
  operations: ['read', 'update'],
  entities: { Order, Customer },
} as const satisfies ConnectorConfig;

export type InventorySchema = GraphQLBackedConnector<
  { Order: typeof Order; Customer: typeof Customer },
  typeof connectorConfig
>;
```

- `GraphQLBackedConnector<TSchema, typeof connectorConfig>` is the one published marker for Category A. Never invent per-type names like `FabricWarehouse`.
- `<Name>Schema` is the PascalCase connector name + `Schema` (`inventory` → `InventorySchema`). It types `client.connectors.<name>.<Entity>` and gates CRUD methods to `operations` at compile time.
- Add one `import`, one `export`, and one `TSchema` key per entity. In **subset mode**, list only the entities you generated — a `typeof` on one you skipped would dangle.
- Read-only Lakehouse: `operations: ['read']`.

### The `entities` map

`connectorConfig.entities` supplies the **default column selection** used by `findMany()`, `findFirst()`, and `findByKey()` when the call passes no selection. **It is required** — omit it and those calls throw `SELECTION_REQUIRED`.

- List the generated entity **classes**, e.g. `entities: { Order, Customer }`. The client reads each class to derive the default column selection and relationship cardinality.
- The default does **not** reach the query chain. A read that starts with `.select()` / `.where()` / `.orderBy()` / `.first()` must carry an explicit `.select([...])`, or `.execute()` throws `SELECTION_REQUIRED` no matter what `entities` contains. See [Querying](./querying.md#which-reads-need-an-explicit-select).

### Keep operations in one place

`connectorConfig.operations` and the YAML `operations:` must match — that pair is the connector-wide ceiling. Each entity's `@role(...)` actions stay a subset of it. Narrow YAML first, mirror it into `connectorConfig.operations`, then grant each entity only the verbs it needs. Never widen a decorator just to match the connector.

## Wire the client

Deploying a connector does not make it callable. Expose it through a `ConnectorsRayfinClient` so it appears as `client.connectors.<name>`. Import that client from the main `@microsoft/rayfin-client` entry. The connector key must be identical in three places: `name` in `rayfin.yml`, the `AppConnectorsSchema` property, and the `connectors` option.

```ts
import { ConnectorsRayfinClient } from '@microsoft/rayfin-client';
import { InventorySchema, connectorConfig as inventoryConfig } from '../../rayfin/connectors/inventory/schema';

type AppConnectorsSchema = { inventory: InventorySchema };

export function getRayfinClient() {
  // Type params: <DataSchema, FunctionsSchema, ConnectorsSchema>. Set unused
  // slots to Record<string, never>.
  return new ConnectorsRayfinClient<Record<string, never>, Record<string, never>, AppConnectorsSchema>({
    baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    authStorage: true,
    connectors: { inventory: inventoryConfig },
  });
}
```

Type-check (`tsc --noEmit` or the app build) to catch a key mismatch, then deploy with `rayfin up`.
