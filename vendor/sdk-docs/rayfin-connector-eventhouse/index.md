---
symbols: []
---

# Eventhouse connector

Eventhouse is the Fabric product name, `eventhouse` is the type id you pass to `rayfin connector add --type eventhouse`, and KQL is its query language. This page is the Eventhouse usage library — when to choose the type, how it performs, how to save queries and the rules the connector function enforces on them, how to test them, and how to read results. The mechanics shared by every function-bridge type — `connector add`, the generated `rayfin.yml` and `schema.ts`, and the `client.connectors.<name>` call — live in the **Category B function-bridge guide** in `@microsoft/rayfin-guide` (`rayfin docs search` / `search_docs`); read it for the contract and return here for Eventhouse-specific guidance. Resolve it from disk under `node_modules/@microsoft/rayfin-guide/assets/docs/`; do not reconstruct it from memory.

> **`eventhouse` authoring is held in this release**, so `connector add --type eventhouse` refuses and search omits Eventhouse KQL databases. Everything below stays accurate for a project that **already declares** an `eventhouse` connector — which still validates, deploys and invokes — and describes the authoring path for when it ships. To complete such a project now, see [While `eventhouse` authoring is held in this release](#while-eventhouse-authoring-is-held-in-this-release).

## When to reach for Eventhouse

Reach for the Eventhouse connector when the app reads **large, append-only, time-series data** — telemetry, logs, events, metrics — that already lives in an Eventhouse KQL Database. Kusto, the engine behind Eventhouse, is built to filter and aggregate billions of such rows in place.

For small relational lookups, or for create, update, and delete on records, use a Category A SQL connector (`fabric-sqldatabase`, `fabric-warehouse`, `fabric-sqlanalytics`) instead. Category A generates typed entity files with CRUD; Eventhouse exposes no entities and no writes — only the `executeQuery` and `executeCommand` operations.

## What streaming buys you

The connector function (`rayfin_eventhouse_v1`) is a **true streaming byte pump**: it relays Kusto's response bytes untouched and never buffers, parses, or re-serializes them. Peak memory at the function stays constant for any result size, and time-to-first-byte is about equal to Kusto's own. A ten-thousand-row aggregation costs the function the same memory as ten rows.

The client is where size matters. `toQueryResult` reads the full Kusto v1 `{ Tables }` document to build typed tables, so the whole result is held in the app. **Bound the query** — return only the rows the app renders. Do not fetch every row and slice it in the browser.

## Save the queries in rayfin.yml

The app runs only queries it saved in the connector's `additionalPayload` in `rayfin.yml`. Rayfin saves the object on `rayfin up` and forwards it unchanged with every call; the connector function (`rayfin_eventhouse_v1`) defines the format, validates it, and runs the saved text with the caller's parameter values. App code sends only a `queryId`, `parameters`, and an optional `clientRequestId` — never query text, the cluster, or the database.

Add `additionalPayload` to the connector's entry, next to `config`:

```yaml
additionalPayload:
  queryServiceUri: "https://<cluster>.kusto.fabric.microsoft.com"
  database: "<kql-database-item-id>" # the same value as config.itemId
  queries:
    stormsByState:
      operation: executeQuery
      text: |
        declare query_parameters(state:string, maxRows:long);
        StormEvents
        | where State == state
        | summarize Events = count() by EventType
        | top min_of(maxRows, 1000) by Events
      parameters:
        state: string
        maxRows: long
```

- `additionalPayload` takes only `queryServiceUri`, `database`, and `queries`.
- `queryServiceUri` is the root `https://<cluster>.kusto.fabric.microsoft.com` endpoint, with no path. Copy it from **Query URI** in the KQL Database details in Fabric.
- `database` is the KQL Database item ID — the same value as `config.itemId`. Never use the parent Eventhouse ID or the database name.
- `queries` holds 1 to 256 templates. Each key is a `queryId` of 1 to 128 ASCII letters, digits, or underscores that does not start with a digit.
- Each template has `operation` (`executeQuery` or `executeCommand`), `text` of up to 65,536 characters, and `parameters` (`{}` when there are none). A template can also list `roles`; leave it out, so that every signed-in user of the app can run the template.
- The whole `additionalPayload` is at most 64 KiB (65,536 bytes) of compact JSON; `rayfin up` refuses a larger one.

`rayfin up` does not check the templates. The connector function checks every saved template on each call, so one invalid template makes every query of the connector fail with `INVALID_QUERY_POLICY`. After each `rayfin up`, [test every saved query](#test-every-saved-query).

## Send the work to Kusto

Put every filter, aggregation, and limit **into the saved KQL**, not into the app. Kusto reduces the data server-side; the connector is a pass-through, so whatever the query returns is exactly what crosses the wire and what `toQueryResult` must hold. Common shapes for saved `executeQuery` text:

```kql
// Top-N aggregation for a chart
StormEvents | summarize count() by State | top 10 by count_

// Time-series buckets for a line chart
Logs | where Timestamp > ago(1h) | summarize count() by bin(Timestamp, 1m)

// Bounded detail view — the device id is a declared parameter
declare query_parameters(deviceId:string);
Events | where DeviceId == deviceId | take 200
```

The connector function and Kusto enforce these rules on the saved text:

- Comments are `//` only. The text must not contain `/*` anywhere, even inside a string literal; send such a value as a parameter.
- An `executeQuery` text is a query, not a management command: after white space and `//` comments, it must not start with `.`.
- The connector function runs every saved text read-only, with remote entities and callouts disabled, so a reference to another cluster fails.

Also follow these rules:

- Read only the connector's database. Do not reference other databases or clusters.
- When a parameter sets the row count, bound it in the text: `take min_of(maxRows, 1000)` or `top min_of(maxRows, 1000) by ...`.
- Do not write `union *`, `search`, or `table(<parameter>)` templates unless the user explicitly asks for them: they let every signed-in user read every table in the database.

## Handling results

Call a saved query as the **Calling an Eventhouse connector** section of the Category B guide shows: generate a `clientRequestId`, pass the same value to `executeQuery` and to `toQueryResult(response, { clientRequestId })`, and check `result.status` before you render. [Test every saved query](#test-every-saved-query) below shows the whole pattern in one piece.

On `success`, read `result.tables`: each table carries named, typed `columns` and row-major `rows`, so map columns to headers and rows to cells. A query with several result sets returns several tables in order; the first is the primary result. On `error`, show `result.error.message` (and `result.error.code` when it is set) and render nothing. Both variants also carry the `clientRequestId` you passed (empty when you pass none) and an optional `activityId`; correlation never rides in the response body.

A call that the connector function refuses does not return a result: it throws, and the error's `serverErrorCode` is one of the [error codes](#error-codes). A `clientRequestId` is a nonblank ASCII string of at most 256 characters, without control characters.

## Passing user input

User input travels only as `parameters`. The connector function sends each value to Kusto as a query parameter, so a value can never change the saved query text.

- Declare every parameter at the start of the saved text with `declare query_parameters(...)`, with the same names and types as the template's `parameters` map. Write `long` in both, never `int`.
- A parameter name is 1 to 128 ASCII letters, digits, or underscores, and does not start with a digit. Use descriptive names: a KQL keyword such as `to` or `from` fails unless the text brackets it as `['to']`.
- A template has at most 128 parameters. A call sends exactly the declared parameters, and no value is `null`.

Send each value in the JSON form that its type requires:

| Type       | Send                                                                                                     | Limits                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `string`   | A string.                                                                                                | Up to 65,536 characters.                                                                                |
| `long`     | A whole number.                                                                                          | A JavaScript number is exact only up to `Number.MAX_SAFE_INTEGER` in magnitude.                         |
| `real`     | A finite number.                                                                                         |                                                                                                         |
| `bool`     | `true` or `false`, not a string.                                                                         |                                                                                                         |
| `datetime` | An ISO 8601 string with a time and `Z` or an offset, for example from `new Date(value).toISOString()`.   | A date-only value is refused. An offset is at most ±14:00.                                              |
| `guid`     | A string in the hyphenated form `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.                                  |                                                                                                         |
| `timespan` | A string such as `"7d"`, `"90m"`, `"100ms"`, or `"1.02:03:04"`.                                          |                                                                                                         |
| `dynamic`  | A flat array of strings, numbers, booleans, or `null`, for example the choices of a multi-select.        | Up to 1,000 items and 100,000 characters as a Kusto `dynamic(...)` literal. No objects, no nested arrays. |

All parameter values of one call together are at most 1,048,576 characters as Kusto literals.

Identifiers (table, column, function names) cannot be parameters. When the user picks among tables or views, save one query per choice and map the user's choice to a `queryId` through a fixed allow-list.

## Management commands

`executeCommand` runs one saved metadata command against the connector's database, through the cluster's `/v1/rest/mgmt` endpoint. Save it under `queries` with `operation: executeCommand` and `parameters: {}`, and call it by `queryId`:

```yaml
queries:
  showTables:
    operation: executeCommand
    text: .show tables
    parameters: {}
```

The text must be exactly one of these commands, with no comments, pipes, further statements, or database names. `T` and `F` stand for a table or function name, written plain or bracketed as `['My Table']`:

- `.show tables`
- `.show table T`
- `.show table T schema as json`
- `.show table T cslschema`
- `.show database schema`
- `.show database schema as json`
- `.show database cslschema`
- `.show functions`
- `.show function F`
- `.show materialized-views`

Management commands return the same native `{ Tables }` document as queries, so normalize them with `toQueryResult` the same way. The **Management commands** section of the Category B guide shows the call.

Declare `executeCommand` under the connector's `operations` only when the app needs one of these commands. A read-only dashboard needs `executeQuery` alone.

## Test every saved query

After each `rayfin up`, test every saved query once through the deployed app, before you build anything on the connector:

1. Add a small test page or button, outside the app's main navigation. It calls every saved `queryId` once, with the template's operation and sample parameter values that return rows, and shows the row count or the error code for each call.
2. Run `rayfin up`, open the app URL that it prints, sign in, and run the test. If you cannot sign in to the app, give the user the URL and ask for the result.
3. Continue only when every query returns rows. If a query fails, fix `rayfin.yml`, run `rayfin up`, and run the whole test again.

```ts
import { toQueryResult, type ExecuteQueryInput } from '@microsoft/rayfin-connector-eventhouse';

const checks: ExecuteQueryInput[] = [
  { queryId: 'stormsByState', parameters: { state: 'TEXAS', maxRows: 10 } },
];

export async function runChecks() {
  const outcomes: { queryId: string; outcome: string }[] = [];
  for (const check of checks) {
    const clientRequestId = `KPC.rayfin_eventhouse_v1;${crypto.randomUUID()}`;
    let outcome: string;
    try {
      const response = await client.connectors.telemetry.executeQuery({ ...check, clientRequestId });
      const result = toQueryResult(response, { clientRequestId });
      outcome =
        result.status === 'success'
          ? `${result.tables[0]?.rows.length ?? 0} rows`
          : (result.error.code ?? result.error.message);
    } catch (error) {
      outcome = (error as { serverErrorCode?: string }).serverErrorCode ?? String(error);
    }
    outcomes.push({ queryId: check.queryId, outcome });
  }
  return outcomes;
}
```

Call `executeCommand` the same way for a template whose `operation` is `executeCommand`.

## Error codes

The connector function returns these codes. The message gives the details; for a problem in a saved template, it names the template.

| Code                       | Cause                                                                                                                                                                                                                   | Fix                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `QUERY_POLICY_REQUIRED`    | `additionalPayload` or its `queries` map is missing or empty.                                                                                                                                                           | Save at least one template, then run `rayfin up`.                                   |
| `INVALID_QUERY_POLICY`     | A saved template, or the shape of `additionalPayload`, is not valid. One invalid template makes every query of the connector fail.                                                                                     | Fix what the message names, run `rayfin up`, and test every saved query again.      |
| `INVALID_CONNECTOR_TARGET` | `queryServiceUri` is not a root Fabric Kusto endpoint, `database` is not a KQL Database item ID, or `database` is not the same as `config.itemId`.                                                                      | Correct `additionalPayload`, then run `rayfin up`.                                  |
| `QUERY_NOT_ALLOWED`        | No saved template has this `queryId`, or the call used another operation than the template's.                                                                                                                          | Call a saved `queryId` with its template's operation.                               |
| `INVALID_QUERY_INPUT`      | The call sent a field other than `queryId`, `parameters`, and `clientRequestId` (for example KQL text), an invalid `queryId` or `clientRequestId`, a missing, extra, or `null` parameter, or a value of the wrong type. | Send exactly the template's declared parameters, each in the form its type requires. |
| `QUERY_ROLE_NOT_ALLOWED`   | The caller is not signed in, or the template lists `roles` that the caller does not have.                                                                                                                               | Sign in, or remove `roles` from the template.                                       |
| `EVENTHOUSE_UNREACHABLE`   | The connector function could not reach `queryServiceUri`.                                                                                                                                                               | Check `queryServiceUri`, then try again later.                                      |
| `INVALID_CALLER_CONTEXT`   | The platform sent the connector function an invalid caller context.                                                                                                                                                    | Not app configuration. Report it.                                                   |

Errors that Kusto returns, for example for an unknown table or column in a saved text, are not in this list: the connector function relays them unchanged.

## While `eventhouse` authoring is held in this release

`eventhouse` authoring is held in this release, so `connector add --type eventhouse` writes no files and prints no install command. For a project that already declares an `eventhouse` connector, do these steps by hand:

1. Install `@microsoft/rayfin-connector-eventhouse` and `@microsoft/rayfin-connectors` at the exact version of the project's `@microsoft/rayfin-cli`. The **Install the packages the generated file imports** section of the Category B guide shows the command.
2. Add `additionalPayload` with the saved queries to the connector's entry, as [Save the queries in rayfin.yml](#save-the-queries-in-rayfinyml) shows.
3. Create `rayfin/connectors/<name>/schema.ts` with the content that the **The Eventhouse scaffold records the cluster in the generated file** section of the Category B guide shows. Name the type after the connector in PascalCase plus `Schema` (`my-logs` gives `MyLogsSchema`), list the connector's declared operations in `Eventhouse<...>`, and set `queryServiceUri` to the Query URI and `databaseName` to the KQL Database name. Leave out the `// @generated — do not edit.` banner: you keep this file up to date by hand, so update the type argument when the connector's operations change. Without this file, when `rayfin/` has no other TypeScript file, the connector step of `rayfin up` fails with `error TS18003: No inputs were found in config file`.
4. Wire the connector into the app client with `eventhouse()` in the runtime map, as the **Wire into the app client** section of the Category B guide shows.

## Where to go next

- **Category B guide** (`@microsoft/rayfin-guide` — `rayfin docs search` / `search_docs`) — the full add, wire, and call contract for `eventhouse`.
- `rayfin connector types --json` — the live catalog: allowed operations, auth mode, required config, and the version-pinned install command for `eventhouse`.
- `rayfin connector add` and `rayfin connector invoke` — the commands that declare and run the connector; their reference pages ship in `@microsoft/rayfin-guide`.
