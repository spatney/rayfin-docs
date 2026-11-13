---
sidebar_position: 6
---

# Category B — function-bridge connectors

Reference for `fabric-semanticmodel` (Power BI semantic model), the experimental `fabric-dataagent` (Fabric Data Agent), and the experimental `eventhouse` (the **Eventhouse** connector — a Fabric Eventhouse KQL Database).
Eventhouse is the Fabric product name, `eventhouse` is the type id you pass to `--type`, and KQL is its query language.

> **`eventhouse` authoring is held in this release**, so `connector add --type eventhouse` refuses and search omits KQL databases. Everything below about `eventhouse` stays accurate for a project that **already declares** one — which still validates, deploys and invokes — and describes the authoring path for when it ships. Of the item-backed types covered here, only `fabric-semanticmodel` can be added today. See [Connectors](./index.md).
>
> **`fabric-dataagent` authoring is held in this release**, and the connector remains experimental, not generally available.
> `connector add --type fabric-dataagent` refuses before writing files; `connector types` and `connector search` omit it.
> Data Agent examples describe the contract for existing configurations and the authoring path for when it is released, not an available setup flow.
> The hold does not disable existing validation, deployment, or invocation paths; live use still requires the backend adapter.
>
> **The Microsoft 365 connector types are experimental and held as well.**
> See [Microsoft 365 connectors (experimental)](#microsoft-365-connectors-experimental).

A Category B connector is a named-operation surface backed by a small, platform-owned function (UDF).
The Builder never writes or sees the function code.

The Builder declares the connector and calls a typed method; the Fabric app backend injects connector configuration and authentication before forwarding to the function.
There are no GraphQL entities, so do **not** generate entity files, `@role` policies, or `metadata.json` entities for these connector types.

For the entity-generating types (`fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`), read the package-owned Category A docs in `@microsoft/rayfin-connector-fabric-graphql` (`rayfin docs search` / `search_docs`) instead.

## What each type exposes

| Type                                  | Operations                                                       | Query language         | Auth               |
| ------------------------------------- | ---------------------------------------------------------------- | ---------------------- | ------------------ |
| `fabric-semanticmodel`                | `executeQuery`                                                   | DAX                    | `delegated` only   |
| `eventhouse` (**experimental**)       | `executeQuery`, `executeCommand`                                 | KQL                    | `application` only |
| `fabric-dataagent` (**experimental**) | `getInfo`, `startTask`, `getTask`, `getTaskResult`, `cancelTask` | Natural language (MCP) | `delegated` only   |

All three are pinned to an adapter version (`version: '1'` today).
`delegated` runs every call as the signed-in user through the on-behalf-of flow; `application` runs it as the app owner.

The Eventhouse adapter authorizes as the app owner and rejects a delegated caller token, so it takes `application` only — `auth.type: delegated` is refused at validation rather than failing at the data plane. Row-level security is therefore evaluated against the owner, not the caller.

The experimental `fabric-dataagent` SDK package also provides an `ask` helper.
`ask` is a client-side convenience composed from the task operations, not a connector operation, so it never appears in `rayfin.yml`.
See [Calling a Data Agent connector](#calling-a-data-agent-connector).

## Add the connector

```bash
rayfin connector add \
  --type eventhouse \
  --workspace-id <ws-id> \
  --item-id <kql-database-item-id> \
  --name telemetry
```

`--item-id` identifies the Fabric item to query: a KQL Database for `eventhouse`, a semantic model for `fabric-semanticmodel`, a published Data Agent for experimental `fabric-dataagent`.
Omit `--name` to derive the connector name from the Fabric item's display name.

The CLI verifies the item, writes the `rayfin.yml` entry, and scaffolds `rayfin/connectors/<name>/schema.ts`.

## Resulting rayfin.yml

```yaml
connectors:
  - name: telemetry
    type: eventhouse
    version: '1'
    config:
      workspaceId: <ws-id>
      itemId: <kql-database-item-id>
    auth:
      type: application
    operations:
      - name: executeQuery
      - name: executeCommand
```

The `config` block is the single source of truth for what to query and is not sent on the client wire.
`eventhouse` allows `executeQuery` and `executeCommand`; `fabric-semanticmodel` allows `executeQuery`; experimental `fabric-dataagent` allows `getInfo`, `startTask`, `getTask`, `getTaskResult` and `cancelTask`.
`auth.type` is `application` for `eventhouse` and `delegated` for the other two.

## The generated schema.ts

`connector add` writes `rayfin/connectors/<name>/schema.ts` with a `// @generated — do not edit.` banner.
Do not hand-edit it.
For released types, regenerate it by removing and re-adding the connector (`rayfin connector remove <name>`, then `rayfin connector add ...`).
Do not remove a held connector to regenerate its files: `connector add` will refuse to recreate it.

For `fabric-semanticmodel` the file exports the typed marker plus a generic runtime config:

```ts
import type { ConnectorConfig } from '@microsoft/rayfin-connectors';
import type { FabricSemanticModel } from '@microsoft/rayfin-connector-fabric-semanticmodel';

export type SalesModelSchema = FabricSemanticModel<'executeQuery'>;

export const connectorConfig = {
  connector: 'fabric-semanticmodel',
} as const satisfies ConnectorConfig;
```

### The Eventhouse scaffold records the cluster in the generated file

`connector add --type eventhouse` resolves the KQL Database's cluster query endpoint and database name from `(workspaceId, itemId)` at add time and writes both into the generated `connectorConfig`:

```ts
import type {
  Eventhouse,
  EventhouseConnectorConfig,
} from '@microsoft/rayfin-connector-eventhouse';

export type TelemetrySchema = Eventhouse<'executeQuery' | 'executeCommand'>;

export const connectorConfig = {
  connector: 'eventhouse',
  queryServiceUri: 'https://<cluster>.kusto.fabric.microsoft.com',
  databaseName: '<database>',
} as const satisfies EventhouseConnectorConfig;
```

Three names appear here and nowhere else:

- `queryServiceUri` — the resolved cluster query endpoint.
- `databaseName` — the resolved KQL database name.
- `EventhouseConnectorConfig` — the Eventhouse-specific config type these two keys satisfy, exported from `@microsoft/rayfin-connector-eventhouse` rather than `@microsoft/rayfin-connectors`.

These values are informational: the `eventhouse()` runtime does not send them.
The connector function reads the cluster and database from the connector's `additionalPayload` in `rayfin.yml` (see [Calling an Eventhouse connector](#calling-an-eventhouse-connector)), so copy the resolved `queryServiceUri` there.
Never send either value from app code.
If the resolved values look wrong, re-add the connector rather than editing the generated file; the values come from Fabric, not from anything you can fix by hand.

The Eventhouse scaffold imports both its marker and `EventhouseConnectorConfig` from `@microsoft/rayfin-connector-eventhouse`, so it does not import `@microsoft/rayfin-connectors` at all.

### The experimental Data Agent scaffold uses the generic config shape

Experimental `fabric-dataagent` needs no client-side routing values.
An existing `schema.ts` uses the generic `ConnectorConfig` shape shown for semantic models above, and a marker whose type argument is the operations declared in `rayfin.yml`:

```ts
import type { FabricDataAgent } from '@microsoft/rayfin-connector-fabric-dataagent';

export type SalesAgentSchema = FabricDataAgent<
  'getInfo' | 'startTask' | 'getTask' | 'getTaskResult' | 'cancelTask'
>;
```

The AppBackend resolves the workspace and Data Agent item from `rayfin.yml`; app code and `fabricDataAgent()` never supply an MCP endpoint.

## Install the packages the generated file imports

`connector add` scaffolds files but installs nothing. It prints the exact pinned command — copy it from that output, or rebuild it from the `packages` array in `rayfin connector types --json`, which carries both the package names and the version:

```bash
# Shape only. Use the version connector add printed, not this one.

# eventhouse (experimental) — marker and config type both come from the eventhouse package
npm install @microsoft/rayfin-connector-eventhouse@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha

# fabric-semanticmodel
npm install @microsoft/rayfin-connector-fabric-semanticmodel@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha

# fabric-dataagent (experimental, authoring held) — existing configurations only
npm install @microsoft/rayfin-connector-fabric-dataagent@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha
```

**Always pin the version.** Connector packages ship in lockstep with the CLI, but their npm `latest` and `preview` tags lag behind, so an unversioned install pulls an older release and its own mismatched `@microsoft/rayfin-data`.

## Wire into the app client

Use `RayfinClient.create` with `connectorsService` as for Category A, but with no entity re-exports and no `GraphQLBackedConnector`.
Import the generated `<Name>Schema` type and `connectorConfig` value, key both maps by the exact `rayfin.yml` connector name, and pass the configs to `connectorsService({ configs })`.

Category B additionally needs a **connector runtime map** as `connectorsService({ configs, runtime })`.
This is not optional: the runtime is what adds request metadata and decodes the response.

- `eventhouse()` adds a `clientRequestId` to each call that lacks one, for out-of-band correlation.
- `fabricSemanticModel()` decodes the Arrow response. Without it, `executeQuery` results cannot be read.
- `fabricDataAgent()` (experimental) normalizes each operation's result and supplies the client-side `ask` helper. Without it, results arrive as raw, un-normalized payloads and `client.connectors.<name>.ask(...)` is posted to the host as an operation it does not know.

Key the runtime map by the same connector name, and call the factory once per connector:

```ts
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { connectorsService } from '@microsoft/rayfin-connectors';
import { eventhouse } from '@microsoft/rayfin-connector-eventhouse';
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

const client = RayfinClient.create({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
  auth: browserSession(),
  services: {
    connectors: connectorsService<AppConnectorsSchema>({
      configs: {
        telemetry: telemetryConfig,
        salesModel: salesModelConfig,
      },
      runtime: {
        telemetry: eventhouse(),
        salesModel: fabricSemanticModel(),
      },
    }),
  },
});
```

The adapter defaults to standalone execution in browsers and Node.js.
Actual CLI callers pass `host: { type: 'cli' }`; verified Fabric embedded callers pass `host: { type: 'embedded' }`.
Do not infer CLI identity from missing browser globals or embedded identity from framing.
For servers and workers without a browser session, use the named `suppliedToken` adapter from `@microsoft/rayfin-client`; those clients have no `auth` namespace.

The connector key must be identical in four places: the `name` in `rayfin.yml`, the property in `AppConnectorsSchema`, the property in the adapter's `configs` map, and the property in its `runtime` map.
At runtime, untyped access with another casing, such as `client.connectors.SalesModel`, still resolves to the `salesModel` client; see [Connector names](./index.md#connector-names).

## Request timeouts

A Category B operation waits up to 5 minutes for a response, the same deadline the backend enforces for connector calls.
Pass `{ timeoutMs }` as the second argument to give up sooner:

```ts
const result = await client.connectors.salesModel.executeQuery(
  { query: "EVALUATE TOPN(10, 'Sales')" },
  { timeoutMs: 20_000 },
);
```

A value above 5 minutes is capped at 5 minutes, and a value of zero or less uses the default.

## Calling an Eventhouse connector

An Eventhouse connector runs only queries saved in its `additionalPayload` in `rayfin.yml`.
Rayfin saves the object on `rayfin up` and forwards it unchanged; the connector function (`rayfin_eventhouse_v1`) defines the format, validates it, and runs the saved text.
See the `@microsoft/rayfin-connector-eventhouse` docs for the format.

Call a saved query by its `queryId` and pass its parameter values.
Correlation ids are not part of the response body — the connector function relays the Kusto bytes untouched — so generate the `clientRequestId` yourself and pass the same value to both `executeQuery` and `toQueryResult`:

```ts
const clientRequestId = `KPC.rayfin_eventhouse_v1;${crypto.randomUUID()}`;

const response = await client.connectors.telemetry.executeQuery({
  queryId: 'stormsByState',
  parameters: { state: 'TEXAS' },
  clientRequestId,
});
```

Optionally normalize the raw Kusto v1 `{ Tables }` document into a discriminated result that preserves every returned Kusto table:

```ts
import { toQueryResult } from '@microsoft/rayfin-connector-eventhouse';

const result = toQueryResult(response, { clientRequestId });
if (result.status === 'success') {
  renderTables(result.tables);
} else {
  showError(result.error.code, result.error.message);
}
```

The `@microsoft/rayfin-connector-eventhouse` docs describe the result, how to pass user input as typed `parameters`, the management commands you can save, and the error codes.

### Management commands

Call a saved management command (`operation: executeCommand`) by its `queryId` in the same way, and normalize its result with `toQueryResult`:

```ts
const clientRequestId = `KPC.rayfin_eventhouse_v1;${crypto.randomUUID()}`;

const tables = await client.connectors.telemetry.executeCommand({
  queryId: 'showTables',
  clientRequestId,
});

const result = toQueryResult(tables, { clientRequestId });
```

## Calling a semantic model connector

`executeQuery` on `fabric-semanticmodel` runs DAX and accepts an optional `resultSetRowCountLimit`.
There is no default.
Omit it and every row comes back, so ask the user for a bound rather than inventing one.

Prefer it over wrapping the DAX in `TOPN` when the user wants a guard rather than a deliberately ranked subset.
Exceeding it fails the query with an `'overflow'` error, so a truncated result announces itself, where a `TOPN` returns a complete-looking partial answer.

Run `rayfin docs search "resultSetRowCountLimit"` for version-locked details, since this behavior is owned by the connector package rather than the CLI.

## Calling a Data Agent connector

> **Experimental; new authoring is held.**
> The API below describes an already-configured connector, not a currently available `connector add` flow.
> It may change substantially in a future release.

A Data Agent answers natural-language questions over the data sources its publisher configured.
Questions can take minutes, so the Data Agent MCP endpoint runs them as tasks.
The connector exposes that lifecycle as named operations — `startTask`, `getTask`, `getTaskResult`, `cancelTask` — plus `getInfo` for the agent's metadata.

Use the `ask` helper for the common case.
`ask` is a client-side convenience, not a connector operation: it uses `getInfo` for metadata discovery, calls `startTask`, polls `getTask` while reporting progress, honours cancellation, applies an overall deadline (5 minutes by default), and returns `getTaskResult`.
It is only typed on `client.connectors.<name>` when the connector allows all five operations: `getInfo`, `startTask`, `getTask`, `getTaskResult`, and `cancelTask`.
`startTask` also requires `getInfo` permission in `rayfin.yml`: it discovers the tool before sending a question and reuses the cached metadata.

```ts
import { FabricDataAgentError } from '@microsoft/rayfin-connector-fabric-dataagent';

const controller = new AbortController();

try {
  const answer = await client.connectors.salesAgent.ask({
    question: 'What were sales by region last quarter?',
    onProgress: (p) => setStatus(p.statusMessage ?? p.status),
    signal: controller.signal,
  });
  render(answer.text);
  if (answer.deepLinkUrl) showLink('Open in Data Agent', answer.deepLinkUrl);
} catch (err) {
  if (
    err instanceof FabricDataAgentError &&
    err.code === 'DATA_AGENT_FORBIDDEN'
  ) {
    showAccessRequest();
  } else {
    throw err;
  }
}
```

`answer.text` joins the text blocks; `answer.content`, `answer.structuredContent`, and `answer.meta` preserve everything the server returned.
`onProgress` and `signal` never leave the browser — the SDK consumes them.

Read the agent's name, description, and tool contract with `getInfo()`; the result is cached per client for five minutes.

Call the task operations directly when the app needs to own the task lifecycle, for example to resume polling after a page reload:

```ts
const started = await client.connectors.salesAgent.startTask({ question });
if (started.kind === 'answer') {
  render(started.answer.text);
} else {
  const { taskId } = started.task;
  // Persist taskId, then later:
  const status = await client.connectors.salesAgent.getTask({ taskId });
  if (status.status === 'completed') {
    const answer = await client.connectors.salesAgent.getTaskResult({ taskId });
    render(answer.text);
  }
}
```

Every operation throws `FabricDataAgentError` with a stable `code` (`DATA_AGENT_FORBIDDEN`, `DATA_AGENT_NOT_PUBLISHED`, `DATA_AGENT_TIMEOUT`, `DATA_AGENT_THROTTLED`, ...), a `retryable` flag, a `category` of `user` or `system`, and a `correlationId` when the service supplied one.

The endpoint is stateless.
To give the agent context from earlier turns, pass them in `history`; the app owns any persisted chat transcript.

## Microsoft 365 connectors (experimental)

> **Experimental; authoring is held.**
> `connector add`, `connector types` and `connector search` do not offer these types.
> The packages describe the contract for an already-configured connector and may change substantially before release.

These connectors are bridged to the Microsoft 365 managed connector APIs.
Entra ships as its own package; the other types ship as subpaths of one Microsoft 365 package. Each package owns the operation reference, auth modes and examples.
Run `rayfin docs search "<type>"` (or `search_docs`) to read the version-locked docs instead of relying on this page.

| Type                           | CLI alias    | Package                                       | Auth                         |
| ------------------------------ | ------------ | --------------------------------------------- | ---------------------------- |
| `office365users`               | `users`      | `@microsoft/rayfin-connector-m365/users`      | `delegated` or `application` |
| `sharepointonline`             | `sharepoint` | `@microsoft/rayfin-connector-m365/sharepoint` | `delegated` or `application` |
| `office365` (Outlook)          | `outlook`    | `@microsoft/rayfin-connector-m365/outlook`    | `application` only           |
| `excelonlinebusiness`          | `excel`      | `@microsoft/rayfin-connector-m365/excel`      | `delegated` or `application` |
| `teams`                        |              | `@microsoft/rayfin-connector-m365/teams`      | `application` only           |
| `onedriveforbusiness`          | `onedrive`   | `@microsoft/rayfin-connector-m365/onedrive`   | `application` only           |
| `office365groups`              | `groups`     | `@microsoft/rayfin-connector-m365/groups`     | `delegated` or `application` |
| `microsoftforms`               | `forms`      | `@microsoft/rayfin-connector-m365/forms`      | `delegated` or `application` |
| `planner`                      |              | `@microsoft/rayfin-connector-m365/planner`    | `delegated` or `application` |
| `azuread` (Microsoft Entra ID) | `entra`      | `@microsoft/rayfin-connector-entra`           | `delegated` or `application` |

`rayfin connector add` and `rayfin connector search` accept the CLI alias for `--type`, case-insensitively (for example `rayfin connector add --type entra`).
`rayfin.yml` and the backend always use the canonical type.
All of them are pinned to adapter `version: '1'`.

## Exercising a Category B connector from the CLI

`rayfin connector invoke <name> <operation>` is the loop for Category B.
See [`connector invoke`](./invoke.md) for payload input, transports, token handling, and the output contract.

- `connector inspect` supports `fabric-semanticmodel` but **not** experimental `eventhouse` — an `eventhouse` connector errors with `Unsupported connector type: eventhouse`.
  There is no ad-hoc query path for Eventhouse connectors today.
- `connector inspect` does not support experimental `fabric-dataagent` either.
  Use `rayfin connector invoke <name> getInfo` to read the agent's metadata.
  `connector invoke` accepts the connector's named operations only; `ask` is a client-side SDK helper, so it is not an operation `invoke` can call.
- `connector invoke` on `fabric-semanticmodel` calls Fabric/Power BI directly under the developer's identity, so it works with or without `rayfin up`.
  Every other type, including experimental `eventhouse`, POSTs to the deployed item and requires a prior `rayfin up`.
- `connector invoke` on `fabric-semanticmodel` returns an already-normalized result, because that connector normalizes inside its `invoke` middleware.
  Do not apply `toQueryResult` to it again.
- A resolved `connector invoke` call is not automatically a success.
  A connector that normalizes reports failure as `status: 'error'`; one that returns the raw service envelope reports it as `status: 'Failed'`.
  The CLI converts either into a non-zero exit.

## Verify

`rayfin dev` parses the `connectors:` block but does not wire Category B calls.
A real `executeQuery` requires `rayfin up`.

## Troubleshooting

| Symptom                                                                                     | Likely cause                                                                                                   | Fix                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connector inspect` errors with `Unsupported connector type: eventhouse`                    | `connector inspect` has no Eventhouse path                                                                     | Test its saved queries from the deployed app, as the `@microsoft/rayfin-connector-eventhouse` docs show.                                           |
| `Cannot find module '@microsoft/rayfin-connector-eventhouse'`                               | `connector add` scaffolds but does not install                                                                 | Run the pinned `npm install` command `connector add` printed; never install unversioned.                                                           |
| The generated `schema.ts` has `queryServiceUri` / `databaseName` you did not expect         | Expected — `connector add` records the resolved cluster; the values are informational                          | Copy `queryServiceUri` into the connector's `additionalPayload`; do not edit the file.                                                             |
| `rayfin up` rejects `auth.type: application` on `fabric-semanticmodel`                      | `fabric-semanticmodel` is delegated-only                                                                       | Set `auth.type: delegated`.                                                                                                                        |
| An Eventhouse query returns the app owner's data instead of the caller's                    | Eventhouse is application-only, so the call runs as the owner and row-level security is evaluated against them | Expected. Enforce per-user access in your app.                                                                                                     |
| An Eventhouse call fails with `INVALID_QUERY_INPUT`                                         | The call sent query text or cluster fields instead of a saved `queryId`                                        | Save the query in `additionalPayload`, redeploy, and call it by `queryId` with values in `parameters`.                                             |
| Another Eventhouse error code is returned                                                   | The connector function refused the call                                                                         | Find the code, its cause, and its fix in the error codes of the `@microsoft/rayfin-connector-eventhouse` docs.                                    |
| A semantic-model `executeQuery` result cannot be read or decoded                            | `fabricSemanticModel()` was not registered, so the Arrow response is never decoded                             | Pass `{ <name>: fabricSemanticModel() }` in `runtime` to `connectorsService({ configs, runtime })`.                                                |
| `client.connectors.<name>.ask` is not typed on an experimental `fabric-dataagent` connector | The connector does not allow every operation `ask` is composed from                                            | Allow `getInfo`, `startTask`, `getTask`, `getTaskResult`, and `cancelTask` in `rayfin.yml`, and list them in the generated marker's type argument. |
| `client.connectors.<name>.ask` fails with an unknown or unsupported operation               | `fabricDataAgent()` was not registered, so `ask` was posted to the host instead of being composed client-side  | Pass `{ <name>: fabricDataAgent() }` in `runtime` to `connectorsService({ configs, runtime })`.                                                    |
| `ask` throws `DATA_AGENT_NOT_PUBLISHED`                                                     | The Data Agent has a draft but no published configuration                                                      | Publish the Data Agent in Fabric, then retry.                                                                                                      |
| `client.connectors.<name>` is not typed                                                     | Connector key differs between `rayfin.yml`, `AppConnectorsSchema`, and `connectorsService`'s `configs`         | Use the `rayfin.yml` `name` in all three.                                                                                                          |
| A Category B call works locally under `rayfin dev`                                          | It does not — `rayfin dev` only parses the block                                                               | Deploy with `rayfin up` and retest.                                                                                                                |
