---
sidebar_position: 6
---

# Category B — function-bridge connectors

Reference for `fabric-semanticmodel` (Power BI semantic model) and the experimental `kusto` (the **Eventhouse** connector — a Fabric Eventhouse KQL Database).
Eventhouse is the Fabric product name; `kusto` is the type id you pass to `--type`, and KQL is its query language.

> **`kusto` authoring is held in this release**, so `connector add --type kusto` refuses and search omits KQL databases. Everything below about `kusto` stays accurate for a project that **already declares** one — which still validates, deploys and invokes — and describes the authoring path for when it ships. Only `fabric-semanticmodel` can be added today. See [Connectors](./index.md).

A Category B connector is a named-operation surface backed by a small, platform-owned function (UDF).
The Builder never writes or sees the function code.

The Builder declares the connector and calls a typed method; the Fabric app backend injects connector configuration and delegated authentication before forwarding to the function.
There are no GraphQL entities, so do **not** generate entity files, `@role` policies, or `metadata.json` entities for these connector types.

For the entity-generating types (`fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`), read the package-owned Category A docs in `@microsoft/rayfin-connector-fabric-graphql` (`rayfin docs search` / `search_docs`) instead.

## What each type exposes

| Type | Operations | Query language | Auth |
| --- | --- | --- | --- |
| `fabric-semanticmodel` | `executeQuery` | DAX | `delegated` only |
| `kusto` (**experimental**) | `executeQuery`, `executeCommand` | KQL | `delegated` only |

Both are pinned to an adapter version (`version: '1'` today).
Delegated authentication runs every call as the signed-in user through the on-behalf-of flow.

## Add the connector

```bash
rayfin connector add \
  --type kusto \
  --workspace-id <ws-id> \
  --item-id <kql-database-item-id> \
  --name telemetry
```

`--item-id` identifies the Fabric item to query: a KQL Database for `kusto`, a semantic model for `fabric-semanticmodel`.
Omit `--name` to derive the connector name from the Fabric item's display name.

The CLI verifies the item, writes the `rayfin.yml` entry, and scaffolds `rayfin/connectors/<name>/schema.ts`.

## Resulting rayfin.yml

```yaml
connectors:
  - name: telemetry
    type: kusto
    version: '1'
    config:
      workspaceId: <ws-id>
      itemId: <kql-database-item-id>
    auth:
      type: delegated
    operations:
      - name: executeQuery
      - name: executeCommand
```

The `config` block is the single source of truth for what to query and is not sent on the client wire.
`kusto` allows `executeQuery` and `executeCommand`; `fabric-semanticmodel` allows `executeQuery`.
In every case `auth.type` must be `delegated`.

## The generated schema.ts

`connector add` writes `rayfin/connectors/<name>/schema.ts` with a `// @generated — do not edit.` banner.
Do not hand-edit it.
Regenerate it by removing and re-adding the connector (`rayfin connector remove <name>`, then `rayfin connector add ...`).

For `fabric-semanticmodel` the file exports the typed marker plus a generic runtime config:

```ts
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';
import type { FabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';

export type SalesModelSchema = FabricSemanticModel<'executeQuery'>;

export const connectorConfig = {
  connector: 'fabric-semanticmodel',
} as const satisfies ConnectorConfig;
```

### The Eventhouse scaffold bakes cluster routing into the generated file

`connector add --type kusto` resolves the KQL Database's cluster query endpoint and database name from `(workspaceId, itemId)` at add time and writes both into the generated `connectorConfig`:

```ts
import type { Kusto, KustoConnectorConfig } from '@microsoft/rayfin-connector-kusto';

export type TelemetrySchema = Kusto<'executeQuery' | 'executeCommand'>;

export const connectorConfig = {
  connector: 'kusto',
  queryServiceUri: 'https://<cluster>.kusto.fabric.microsoft.com',
  databaseName: '<database>',
} as const satisfies KustoConnectorConfig;
```

Three names appear here and nowhere else:

- `queryServiceUri` — the resolved Kusto cluster query endpoint.
- `databaseName` — the resolved KQL database name.
- `KustoConnectorConfig` — the Kusto-specific config type these two keys satisfy, exported from `@microsoft/rayfin-connector-kusto` rather than `@microsoft/rayfin-connectors`.

These keys live only in the file the Eventhouse scaffold writes.
They are **not** part of the shared `rayfin.yml` schema — never write a cluster URI or database name into `rayfin.yml`, and never send either value from app code.
If the resolved values look wrong, re-add the connector rather than editing the generated file; the values come from Fabric, not from anything you can fix by hand.

The Eventhouse scaffold imports both its marker and `KustoConnectorConfig` from `@microsoft/rayfin-connector-kusto`, so it does not import `@microsoft/rayfin-connectors` at all.

## Install the packages the generated file imports

`connector add` scaffolds files but installs nothing. It prints the exact pinned command — copy it from that output, or rebuild it from the `packages` array in `rayfin connector types --json`, which carries both the package names and the version:

```bash
# Shape only. Use the version connector add printed, not this one.

# kusto (experimental) — marker and config type both come from this one package
npm install @microsoft/rayfin-connector-kusto@1.35.0-alpha

# fabric-semanticmodel
npm install @microsoft/rayfin-connector-fabric-semanticmodel@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha
```

**Always pin the version.** Connector packages ship in lockstep with the CLI, but their npm `latest` and `preview` tags lag behind, so an unversioned install pulls an older release and its own mismatched `@microsoft/rayfin-data`.

## Wire into the app client

Use the same `ConnectorsRayfinClient` wiring as Category A, but with no entity re-exports and no `GraphQLBackedConnector`.
Import the generated `<Name>Schema` type and `connectorConfig` value, key both maps by the exact `rayfin.yml` connector name, and pass the config through the client's `connectors` option.

Category B additionally needs a **connector runtime map** as the client's second constructor argument.
This is not optional: the runtime is what injects the generated routing and decodes the response.

- `kusto()` merges the generated `queryServiceUri` and `databaseName` into the outbound payload. Without it, `executeQuery` and `executeCommand` cannot route to the cluster.
- `fabricSemanticModel()` decodes the Arrow response. Without it, `executeQuery` results cannot be read.

Key the runtime map by the same connector name, and call the factory once per connector:

```ts
import { ConnectorsRayfinClient } from '@microsoft/rayfin-client';
import { kusto } from '@microsoft/rayfin-connector-kusto';
import { fabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import {
  type TelemetrySchema,
  connectorConfig as telemetryConfig,
} from '../../rayfin/connectors/telemetry/schema';
import {
  type SalesModelSchema,
  connectorConfig as salesModelConfig,
} from '../../rayfin/connectors/salesModel/schema';

type AppConnectorsSchema = {
  telemetry: TelemetrySchema;
  salesModel: SalesModelSchema;
};

const client = new ConnectorsRayfinClient<
  Record<string, never>,
  Record<string, never>,
  AppConnectorsSchema
>(
  {
    baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    connectors: {
      telemetry: telemetryConfig,
      salesModel: salesModelConfig,
    },
  },
  // Second argument: per-connector runtime hooks, keyed by connector name.
  {
    telemetry: kusto(),
    salesModel: fabricSemanticModel(),
  }
);
```

`ConnectorsRayfinClient` is stable — import it from the main `@microsoft/rayfin-client` entry.

The connector key must be identical in four places: the `name` in `rayfin.yml`, the property in `AppConnectorsSchema`, the property in the `connectors` option, and the property in the runtime map.

## Calling an Eventhouse connector

Correlation ids are not part of the response body — the connector function relays the Kusto bytes untouched — so generate the `clientRequestId` yourself and pass the same value to both `executeQuery` and `toQueryResult`:

```ts
const clientRequestId = `KPC.rayfin_kusto_v1;${crypto.randomUUID()}`;

const response = await client.connectors.telemetry.executeQuery({
  query: 'StormEvents | summarize count() by State | top 10 by count_',
  clientRequestId,
});
```

Optionally normalize the raw Kusto v1 `{ Tables }` document into a discriminated result that preserves every returned Kusto table:

```ts
import { toQueryResult } from '@microsoft/rayfin-connector-kusto';

const result = toQueryResult(response, { clientRequestId });
if (result.status === 'success') {
  renderTables(result.tables);
} else {
  showError(result.error.code, result.error.message);
}
```

Successful results contain `tables` plus the `clientRequestId` you passed in (empty when you pass none) and an optional `activityId`; correlation is never on the wire.
Each table contains named typed `columns` and row-major `rows`.
Error results contain `error.message` and an optional `error.code`.

### Building queries safely

`executeQuery` takes its KQL in `query` and `executeCommand` takes its command in `command`; neither operation binds parameters — `ExecuteQueryInput` exposes only `query` and `clientRequestId`, and `ExecuteCommandInput` only `command` and `clientRequestId`. Every user value you place in that text runs as KQL, so treat all user input as unsafe and never interpolate it raw.

- **Identifiers** (table, column, function names): map the user's choice through a fixed allow-list to a known-good constant. Never build an identifier from user text.
- **Values**: serialize each as a typed KQL literal. Validate numbers (for example with `Number.isFinite`), parse datetimes to ISO 8601 and wrap them in `todatetime(...)`, and for strings escape `\` and `"` and reject control characters. This repo ships no KQL encoder; generic SQL or JSON escaping does not make KQL safe.

```ts
const TABLES = { events: 'Events', logs: 'Logs' } as const;
const table = TABLES[userTable];
if (!table) throw new Error('unknown table');

// Typed KQL string literal: escape backslash and double-quote, reject control chars.
function kqlString(value: string): string {
  if (/[\u0000-\u001F]/.test(value)) throw new Error('control character in value');
  return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
// kqlString('contoso "42"')  ->  "contoso \"42\""

const query = `${table} | where DeviceId == ${kqlString(userDeviceId)} | take 200`;
```

### Management commands

`executeCommand` runs a Kusto management (control) command — the command text starts with a leading dot.
It returns the same native Kusto v1 `{ Tables }` document as `executeQuery`, so normalize it with `toQueryResult` the same way, and pass a matching `clientRequestId` to correlate end to end:

```ts
const clientRequestId = `KPC.rayfin_kusto_v1;${crypto.randomUUID()}`;

const databases = await client.connectors.telemetry.executeCommand({
  command: '.show databases',
  clientRequestId,
});

const result = toQueryResult(databases, { clientRequestId });
```

## Calling a semantic model connector

`executeQuery` on `fabric-semanticmodel` runs DAX and accepts an optional `resultSetRowCountLimit`.
There is no default.
Omit it and every row comes back, so ask the user for a bound rather than inventing one.

Prefer it over wrapping the DAX in `TOPN` when the user wants a guard rather than a deliberately ranked subset.
Exceeding it fails the query with an `'overflow'` error, so a truncated result announces itself, where a `TOPN` returns a complete-looking partial answer.

Run `rayfin docs search "resultSetRowCountLimit"` for version-locked details, since this behavior is owned by the connector package rather than the CLI.

## Exercising a Category B connector from the CLI

`rayfin connector invoke <name> <operation>` is the loop for Category B.
See [`connector invoke`](./invoke.md) for payload input, transports, token handling, and the output contract.

- `connector inspect` supports `fabric-semanticmodel` but **not** experimental `kusto` — a `kusto` connector errors with `Unsupported connector type: kusto`.
  There is no ad-hoc query path for Kusto connectors today.
- `connector invoke` on `fabric-semanticmodel` calls Fabric/Power BI directly under the developer's identity, so it works with or without `rayfin up`.
  Every other type, including experimental `kusto`, POSTs to the deployed item and requires a prior `rayfin up`.
- `connector invoke` on `fabric-semanticmodel` returns an already-normalized result, because that connector normalizes inside its `invoke` middleware.
  Do not apply `toQueryResult` to it again.
- A resolved `connector invoke` call is not automatically a success.
  A connector that normalizes reports failure as `status: 'error'`; one that returns the raw service envelope reports it as `status: 'Failed'`.
  The CLI converts either into a non-zero exit.

## Verify

`rayfin dev` parses the `connectors:` block but does not wire Category B calls.
A real `executeQuery` requires `rayfin up`.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `connector inspect` errors with `Unsupported connector type: kusto` | `connector inspect` has no Kusto path | Use `rayfin connector invoke <name> executeQuery` instead. |
| `Cannot find module '@microsoft/rayfin-connector-kusto'` | `connector add` scaffolds but does not install | Run the pinned `npm install` command `connector add` printed; never install unversioned. |
| The generated `schema.ts` has `queryServiceUri` / `databaseName` you did not expect | Expected — Kusto cluster routing is resolved at add time and baked in | Do not edit the file. Re-add the connector to re-resolve. |
| `rayfin up` rejects `auth.type: application` | Category B connectors are delegated-only | Set `auth.type: delegated`. |
| A Kusto query fails to reach the cluster, or the request carries no `queryServiceUri` | The runtime map was omitted, so nothing injected the generated routing | Pass `{ <name>: kusto() }` as the client's second constructor argument. |
| A semantic-model `executeQuery` result cannot be read or decoded | `fabricSemanticModel()` was not registered, so the Arrow response is never decoded | Pass `{ <name>: fabricSemanticModel() }` as the client's second constructor argument. |
| `client.connectors.<name>` is not typed | Connector key differs between `rayfin.yml`, `AppConnectorsSchema`, and the `connectors` option | Use the `rayfin.yml` `name` in all three. |
| A Category B call works locally under `rayfin dev` | It does not — `rayfin dev` only parses the block | Deploy with `rayfin up` and retest. |
