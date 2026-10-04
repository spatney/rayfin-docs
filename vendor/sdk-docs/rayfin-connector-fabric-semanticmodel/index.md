---
symbols: []
---

# @microsoft/rayfin-connector-fabric-semanticmodel

Typed connector for Fabric semantic models (Power BI datasets). Exposes one
operation, `executeQuery`, which runs DAX.

## Installation

```bash
npm install @microsoft/rayfin-connector-fabric-semanticmodel
```

Register the model in `rayfin/rayfin.yml` with `rayfin connector add`, then call
it through `@microsoft/rayfin-client`. The `workspaceId` and `itemId` live in the
YAML and are injected server-side, so the client never sends them and no ids
reach the bundle.

## Wiring the client

Declare the connector in the app's schema:

```ts
// rayfin/connectors/schema.ts
import type { ConnectorsSchema } from "@microsoft/rayfin-client";
import type { FabricSemanticModel } from "@microsoft/rayfin-connector-fabric-semanticmodel";

export type AppConnectorsSchema = {
  salesModel: FabricSemanticModel<"executeQuery">;
};
```

Pass it as the third type parameter, supply the generated config, and register
the runtime under the same name:

```ts
import { ConnectorsRayfinClient } from "@microsoft/rayfin-client";
import { fabricSemanticModel } from "@microsoft/rayfin-connector-fabric-semanticmodel";
import type { AppConnectorsSchema } from "../rayfin/connectors/schema";
import { connectorConfig as salesModelConfig } from "../rayfin/connectors/salesModel/schema";

const client = new ConnectorsRayfinClient<
  DataSchema,
  FunctionsSchema,
  AppConnectorsSchema
>(
  {
    baseUrl: import.meta.env.VITE_RAYFIN_BASE_URL,
    publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
    connectors: { salesModel: salesModelConfig },
  },
  { salesModel: fabricSemanticModel() }
);
```

`connectors` is required and exhaustive: every connector declared in
`AppConnectorsSchema` needs an entry, keyed by its `rayfin.yml` name. The
generated `connectorConfig` is `{ connector: 'fabric-semanticmodel' }`, so the
routing ids never reach the bundle.

Registering the runtime, the second argument, is what makes the declared
operation types accurate. A client built without it bypasses the middleware and
receives the raw transport payload, so `executeQuery` would not return the shape
the types promise.

## Running a query

```ts
const result = await client.connectors.salesModel.executeQuery({
  query: "EVALUATE TOPN(10, Sales)",
});
```

`executeQuery` resolves to an already-normalised, column-aligned discriminated
union, because the connector folds the wire response inside its `invoke`
middleware. Branch on `result.status` directly:

```ts
if (result.status === "success") {
  renderTable(result.table.columns, result.table.rows);
} else {
  showError(result.error.category, result.error.message);
}
```

Column `dataType` comes from the Arrow schema, e.g. `'Int64'`, and falls back to
`'unknown'` only when the payload carried no column metadata and the columns had
to be inferred from the first row.

`toQueryResult` remains exported for callers written against the older contract.
It is idempotent: an already-normalised result passes through unchanged rather
than matching none of the error branches and collapsing into an empty success.

## Error categories

Every failure comes back as a failed result carrying a category, so callers can
tell the failure modes apart without matching on message strings:

| Category    | Meaning                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `network`   | The request never reached Power BI. Carries the underlying diagnostic, such as a DNS or TLS failure |
| `api`       | Power BI rejected the request, typically auth or permissions                                    |
| `query`     | Power BI ran the query and returned an error, such as invalid DAX                               |
| `overflow`  | A row or byte cap truncated the result. See [Limiting rows](#limiting-rows)                     |
| `unknown`   | The failure did not match any of the above                                                      |

The direct execution functions never throw. A caller that has to `try`/`catch`
on some paths but not others gets no benefit from a uniform envelope, so network
failures are converted into `network` results instead of propagating as
exceptions.

The failed arm satisfies `ConnectorErrorResult` from
`@microsoft/rayfin-connectors`, so anything downstream can read it through
`isConnectorError` without knowing which connector produced it:

```ts
import { isConnectorError } from "@microsoft/rayfin-connectors";

if (isConnectorError(result)) {
  showError(result.error.category, result.error.message);
}
```

An error may also carry `recoveryHint`, which the connector sets only where the
usual reading of a failure would mislead. A 401 with an empty body is the case
worth knowing: Power BI describes a permissions failure rather than answering
with nothing, so an empty body means the request was rejected before model
access was ever evaluated. The hint says to check the token and its audience
first, because auditing workspace permissions there is time spent on something
that was never the cause.

## Limiting rows

`executeQuery` accepts an optional `resultSetRowCountLimit`:

```ts
await client.connectors.salesModel.executeQuery({
  query: "EVALUATE Sales",
  resultSetRowCountLimit: 500,
});
```

Prefer it over wrapping the DAX in `TOPN` when you want a guard rather than a
deliberately ranked subset. It is a field on the request body, not a rewrite of
the query: no `TOPN` is injected and Analysis Services enforces the cap.
Exceeding the limit fails the query with a structured error categorised as
`overflow`, so a truncated result announces itself, where a `TOPN` returns a
complete-looking partial answer.

**There is no default.** A query with no limit on either the input or the
runtime options returns every row, so a caller that needs a bound has to ask for
one. To cap every query regardless of the caller, set `resultSetRowCountLimit` in
the runtime options instead; a limit on the input wins over the runtime default.

An unusable value, meaning anything that is not a positive integer, is dropped
rather than rejected. The query then runs unbounded, which is the same outcome as
omitting the field.

## The connector runtime

`fabricSemanticModel()` returns a `ConnectorRuntime`. It exists so the same app
code works in the CLI inner loop, where no app is deployed and so no User Data
Function exists to call.

```ts
const runtime = fabricSemanticModel({
  target: { workspaceId: "<workspace-guid>", itemId: "<model-guid>" },
});
```

| Option        | Purpose                                                                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`      | The semantic model to query, as a value or a resolver. A resolver lets the target come from configuration only known at run time. Omit it, or return `undefined`, to delegate to the standalone path |
| `baseUrl`     | Override the Power BI REST base URL. Takes precedence over `endpoints`                                                                                                                        |
| `endpoints`   | Derive the base URL from a set of environment endpoints, for sovereign clouds and pre-production rings. Ignored when `baseUrl` is set                                                          |
| `sessionId`   | Sent as the `activityid` header, correlating every request from one runtime in service-side telemetry                                                                                          |
| `getToken`    | Supply the Power BI access token for the CLI path. See [Token audience](#token-audience)                                                                                                       |

Query options (`culture`, `schemaOnly`, `queryTimeout`,
`resultSetRowCountLimit`) can also be set here, applying to every query the
runtime runs.

### Resolving a target from a portal URL

`parseSemanticModelUrl` turns a URL copied from the address bar into a target, so
developers do not have to dig GUIDs out by hand. Query strings, fragments and
sub-pages are all tolerated:

```ts
import { parseSemanticModelUrl } from "@microsoft/rayfin-connector-fabric-semanticmodel";

const runtime = fabricSemanticModel({
  target: () => parseSemanticModelUrl(process.env.SEMANTIC_MODEL_URL!),
});
```

Both `https://app.powerbi.com/groups/{workspaceId}/datasets/{itemId}` and
`https://app.powerbi.com/onelake/details/{workspaceId}/dataset/{itemId}` are
supported. `parseFabricUrl` is the more general form, returning the item type
alongside the ids. Both throw on a URL they cannot understand, because they are
called from configuration code where an unparseable URL is a setup mistake the
developer needs told about immediately.

## The invoke middleware

Row-limit validation runs in middleware, before the input reaches any transport,
so the same rule holds on the CLI and the delegated path alike.

This is a convenience, not a guarantee. A client that registers no runtime, or
that calls `invoke()` directly, never runs the middleware. The service is the
only place an unusable limit can be rejected for good, so do not treat the
middleware as an enforcement point.

Two host paths exist and diverge before transport:

| Host            | Path                                                                  |
| --------------- | --------------------------------------------------------------------- |
| `cli`           | direct HTTPS to the Power BI `executeQueries` endpoint, Arrow response |
| everything else | delegated through the platform to the backing function, JSON response  |

The CLI branch also delegates whenever it is not equipped to service the call:
no pre-authenticated HTTP client, no configured target, or no query in the input.
Falling through this way keeps the connector working everywhere, rather than
failing in the environments the direct branch does not cover.

Both converge on the same normalisation in the middleware, so the shape you get
is identical either way. Reachability is not, so a query that succeeds under
`rayfin connector invoke` during authoring has not yet exercised the deployed
path.

## Token audience

The CLI path talks to `api.powerbi.com` directly, which requires a token with the
`https://analysis.windows.net/powerbi/api` audience. `ctx.http` injects the
Rayfin SDK's own token instead, and offers no way to select an audience, so Power
BI answers 401 or 403 on a request that is otherwise built correctly.

`getToken` closes that gap. `ApiClient.prepareHeaders` only injects its own token
when the caller has not set `Authorization`, so an explicit header wins:

```ts
fabricSemanticModel({
  target,
  getToken: async () => (await credential.getToken(POWER_BI_SCOPE)).token,
});
```

It may be sync or async, since acquiring a token usually means a call into a
credential library. A bare token is given the `Bearer` scheme; one that already
carries it is passed through unchanged.

It is optional, and deliberately so. A provider that returns nothing or throws
leaves the header unset, and the request goes out under the connectors layer's
token: when the audience gap is closed on the Rayfin side, dropping `getToken` is
the only change needed. Only the CLI path reads it, so it can never collide with
the token used by the standalone or embedded transports.

## Authoring queries

`rayfin connector invoke <name> executeQuery --file query.json` runs a query
against a registered connector. The file holds the operation input, so the row
limit goes in the payload rather than on a flag:

```jsonc
{ "query": "EVALUATE Sales", "resultSetRowCountLimit": 500 }
```

A `401` from this path usually means `RAYFIN_CLIENT_ID` is unset rather than that
the model permissions are wrong, since the CLI otherwise falls back to a
placeholder client id. It surfaces as an HTTP 401 with an empty body, and the
recovery hint points at workspace access, so it is easy to spend the next hour
auditing permissions that were never the problem.
