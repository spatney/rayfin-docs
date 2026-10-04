---
symbols: []
---

# Eventhouse (`kusto`) connector

Eventhouse is the Fabric product name; `kusto` is the type id you pass to `rayfin connector add --type kusto`; KQL is its query language. This page is the Eventhouse usage library — when to choose the type, how it performs, how to shape KQL, and how to read results. The mechanics shared by every function-bridge type — `connector add`, the generated `rayfin.yml` and `schema.ts`, and the `client.connectors.<name>` call — live in the **Category B function-bridge guide** in `@microsoft/rayfin-guide` (`rayfin docs search` / `search_docs`); read it for the contract and return here for Kusto-specific guidance. Resolve it from disk under `node_modules/@microsoft/rayfin-guide/assets/docs/`; do not reconstruct it from memory.

> **`kusto` authoring is held in this release**, so `connector add --type kusto` refuses and search omits Eventhouse KQL databases. Everything below stays accurate for a project that **already declares** a Kusto connector — which still validates, deploys and invokes — and describes the authoring path for when it ships.

## When to reach for Eventhouse

Reach for the Eventhouse (`kusto`) connector when the app reads **large, append-only, time-series data** — telemetry, logs, events, metrics — that already lives in an Eventhouse KQL Database. Kusto is built to filter and aggregate billions of such rows in place.

For small relational lookups, or for create, update, and delete on records, use a Category A SQL connector (`fabric-sqldatabase`, `fabric-warehouse`, `fabric-sqlanalytics`) instead. Category A generates typed entity files with CRUD; Eventhouse exposes no entities and no writes — only the `executeQuery` and `executeCommand` operations.

## What streaming buys you

The connector function (`rayfin_kusto_v1`) is a **true streaming byte pump**: it relays Kusto's response bytes untouched and never buffers, parses, or re-serializes them. Peak memory at the function stays constant for any result size, and time-to-first-byte is about equal to Kusto's own. A ten-thousand-row aggregation costs the function the same memory as ten rows.

The client is where size matters. `toQueryResult` reads the full Kusto v1 `{ Tables }` document to build typed tables, so the whole result is held in the app. **Bound the query** — return only the rows the app renders. Do not fetch every row and slice it in the browser.

## Send the work to Kusto

Put every filter, aggregation, and limit **into the KQL**, not into the app. Kusto reduces the data server-side; the connector is a pass-through, so whatever the query returns is exactly what crosses the wire and what `toQueryResult` must hold. Common shapes for `executeQuery`:

```kql
// Top-N aggregation for a chart
StormEvents | summarize count() by State | top 10 by count_

// Time-series buckets for a line chart
Logs | where Timestamp > ago(1h) | summarize count() by bin(Timestamp, 1m)

// Bounded detail view — literal only, no user input
Events | where DeviceId == "contoso-device-42" | take 200
```

## Handling results

`toQueryResult(response, { clientRequestId })` returns a discriminated union — check `result.status` before you render:

```ts
import { toQueryResult } from '@microsoft/rayfin-connector-kusto';

const clientRequestId = `KPC.rayfin_kusto_v1;${crypto.randomUUID()}`;
const response = await client.connectors.telemetry.executeQuery({
  query: 'StormEvents | summarize count() by State | top 10 by count_',
  clientRequestId,
});

const result = toQueryResult(response, { clientRequestId });
if (result.status === 'success') {
  renderTables(result.tables); // each table: typed `columns` + row-major `rows`
} else {
  showError(result.error.message); // optional result.error.code
}
```

On `success`, read `result.tables`: each table carries named, typed `columns` and row-major `rows`, so map columns to headers and rows to cells. A query with several result sets returns several tables in order; the first is the primary result. On `error`, show `result.error.message` and render nothing. Both variants also carry the `clientRequestId` you passed (empty when you pass none) and an optional `activityId`; correlation never rides in the response body.

## Building queries safely

Neither operation binds parameters — every user value you place in the query text runs as KQL. Treat all user input as unsafe:

- **Identifiers** (table, column, function names): map the user's choice through a fixed allow-list to a known-good constant. Never build an identifier from user text.
- **Values**: serialize each as a typed KQL literal. Validate numbers, parse datetimes and wrap them in `todatetime(...)`, and for strings escape `\` and `"` and reject control characters. This repo ships no KQL encoder, and generic SQL or JSON escaping does not make KQL safe.

The Category B guide's **Building queries safely** section (in `@microsoft/rayfin-guide`, `rayfin docs search` / `search_docs`) carries a worked allow-list and a `kqlString` string-serializer to copy; use it as the single source for that code rather than re-deriving it.

## Management commands

`executeCommand` runs a Kusto **management** (control) command — the text must start with a leading dot (for example `.show database schema`) and routes to the cluster's `/v1/rest/mgmt` endpoint. `ExecuteCommandInput` exposes only `command` and `clientRequestId`. Management commands return the same native `{ Tables }` document as queries, so normalize them with `toQueryResult` the same way. See the **Management commands** section of the Category B guide in `@microsoft/rayfin-guide`.

Grant `executeCommand` only when the app truly administers the database. A read-only dashboard needs `executeQuery` alone — narrow the operations at `connector add` time.

## Where to go next

- **Category B guide** (`@microsoft/rayfin-guide` — `rayfin docs search` / `search_docs`) — the full add, wire, and call contract for `kusto`, including the cluster routing baked into the generated `schema.ts`.
- `rayfin connector types --json` — the live catalog: allowed operations, auth mode, required config, and the version-pinned install command for `kusto`.
- `rayfin connector add` and `rayfin connector invoke` — the commands that declare and run the connector; their reference pages ship in `@microsoft/rayfin-guide`.
