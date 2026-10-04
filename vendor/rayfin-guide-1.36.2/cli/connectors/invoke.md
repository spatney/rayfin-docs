---
sidebar_position: 4
---

# connector invoke

```bash
npx rayfin connector invoke <connector-name> <operation> (--input '<json>' | --file <path>) [--output-file <path>] [--max-inline-bytes <bytes>] [--verbose] [--json]
```

`connector invoke` runs a single named operation against a configured connector and prints the result. It is the loop for exercising [Category B connectors](./index.md#two-categories-of-connector) — `executeQuery` over DAX or KQL — without writing any app code.

Both positionals also have flag forms, `--name <name>` and `--operation <operation>`, which win over the positionals when both are given.

Run it from inside a Rayfin project: it resolves `rayfin/rayfin.yml`, and fails with a recovery hint if there is no project root or the `connectors:` block is empty.

## Payload input

Exactly one of these is required — passing both, or neither, fails:

- `--input '<json>'` — inline JSON payload for the operation input.
- `--file <path>` — path to a JSON file. The path is resolved against the project root, and **the resolved path must stay inside it**; a `../` escape is rejected before the file is read. An absolute path is accepted as long as it resolves inside the project root.

## Operation resolution

The requested operation is matched **case-insensitively** against the connector's `operations:` list in `rayfin.yml`. If that entry has no `operations:`, the connector type's full catalog allowlist is used instead. A miss fails with the allowed set listed.

## Transports

Two transports, chosen by connector type:

- **`fabric-semanticmodel`** — the CLI calls Fabric/Power BI **directly under the developer's own identity**, so this works whether or not `npx rayfin up` has been run. It requires `workspaceId` **and** `itemId` under the connector's `config:` block; without both, it fails up front rather than falling through to the deployed transport. The Power BI scope and audience are derived from the configured Fabric API base URL, so an INT ring mints an INT-audience token.
- **Every other type, including `kusto`** — POSTs to the deployed item at `<remote-endpoint>/__private/connectors/<name>/invoke`, so it requires a prior `npx rayfin up`.

> `kusto` authoring is held in this release, but invocation is deliberately preserved: a project that already declares a Kusto connector can still invoke it. Only `connector add`, `types` and `search` withdraw the type. See [Connectors](./index.md).

`--transport deployed` overrides the type-based choice and forces the deployed route. That route authenticates the **app**, not the developer, so it needs an app-session token in `RAYFIN_TOKEN`; `npx rayfin login` cannot mint one.

## Token handling (semantic model path)

`npx rayfin login` only consents to the Fabric scope, not the Power BI scope this path needs. Consequences:

- Interactively (no `--json`), the CLI prompts to complete Power BI consent.
- With `--json`, token acquisition is **silent-only** so prompts cannot corrupt the single-JSON-object contract. If consent is still needed the command fails and tells you to drop `--json` or set `RAYFIN_TOKEN`.
- `RAYFIN_TOKEN`, when set, is passed through **unchanged** regardless of the scopes requested. Its audience is decoded and checked locally, so a wrong-audience or undecodable token fails with a clear message instead of surfacing later as a phantom workspace-permission error.

## Output

`--verbose` cannot be combined with `--json` — narration would break the single-object contract.

Success emits `{status: 'ok', connector, operation, output}`. In non-JSON modes it prints `✅ Invoked <name>.<operation>` followed by the output.

A result larger than 8 KB is written to a file instead of being printed whole; see [Large results](#large-results).

What `output` holds depends on the connector. `fabric-semanticmodel` normalises inside its `invoke` middleware, so `output` is already a discriminated result rather than the raw service envelope: `{status: 'success', table, requestId}`, where `table.columns` are `{name, dataType}` and `table.rows` are column-aligned arrays. No caller-side conversion is needed, and the same shape comes back whether the operation ran locally or through the deployed item.

A resolved call is **not** automatically a success, and the failure signal depends on the same distinction. A connector that normalises reports Power BI failures — expired token, missing Build permission, throttling — as `{status: 'error', error, requestId}`, where `error` carries `category`, `message`, and optional `code` and `details`. A connector that returns the raw envelope reports failure as `status: 'Failed'` instead. The CLI reads both, converts either into a non-zero exit, and surfaces the service-supplied request id for tracing.

In JSON mode, failures keep the top-level `error` as a human-readable **string**, with `recovery` and `requestId` when available.
Connector failures additionally expose a `connectorError` object containing the available `message`, `category`, `code`, and `details` fields.
Scalar values are stringified and structured values are JSON-encoded, so a numeric `code` or object `details` survives; empty and unavailable fields are omitted, and unrelated CLI failures do not acquire connector metadata.
The remediation hint stays on the top-level `recovery` string only, so `connectorError` never carries a CLI-fabricated hint.
This applies to both direct and deployed invocation, including DAX errors returned inside an HTTP 200 Arrow stream.
The semantic-model SDK also preserves the Arrow error code and description as `error.code` and `error.details` in its normalized result.
Existing engine-markup cleanup still applies to normalized messages and details.

For example, an invalid DAX query exits with code `1` and can emit:

```json
{
  "status": "error",
  "error": "Connector invoke failed (DAX_ERROR): Column not found",
  "recovery": "The service ran the operation and reported an error. Fix the query and retry.",
  "requestId": "service-request-id",
  "connectorError": {
    "message": "Column not found",
    "category": "query",
    "code": "DAX_ERROR",
    "details": "The column Foo does not exist"
  }
}
```

Read `connectorError.code` and `connectorError.details` rather than parsing the display string.
Service diagnostics may contain query or model content; review them before sharing or recording them in logs.

## Large results

A query has no upper bound on how much it returns, and printing a multi-megabyte result set floods a terminal — or, when an agent runs the CLI and reads its stdout, burns the agent's context window on rows it cannot use.

When the serialized result exceeds **8 KB**, the full payload is written to a file and `output` carries only a preview.

That threshold is a token budget, not a byte intuition.
Connector output tokenizes at roughly 2.8 characters per token, and numeric table data at about 1.8, so 8 KB is around 3k–4.5k tokens — a reasonable cost for one probe.
For scale, 256 KB of the same data is 93,000–144,000 tokens, which is most of a typical context window.

The preview samples bulk data but preserves metadata: arrays of **50 or fewer** entries pass through whole, longer arrays keep their first 20 entries, and long strings are cut.
That rule is what keeps a column list intact — a sampled column list would report a partial schema with nothing marking it partial, so a caller asking what a query returns would get a confident wrong answer.
If a 20-entry sample would itself exceed the threshold, the sample shrinks (10, 5, 2, 1) until it fits; only if no setting fits does `output` become `null`.

The envelope gains these fields, so this is detectable rather than silent:

| Field             | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `outputFile`      | Absolute path the full result was written to.                |
| `outputBytes`     | Serialized size of the full result, in bytes.                 |
| `outputTruncated` | `true` when `output` is a preview rather than the whole result. |
| `previewItems`    | Entries kept from each sampled array, or `0` when `output` is `null`. |

Read `outputFile` instead of re-running the query.
The file holds exactly what `output` would have held, so it can be passed straight to `jq` or opened by an agent.

Spilled results are written to `<project-root>/rayfin/.temp/invoke-results/` with owner-only permissions, and are pruned after 14 days or 20 files, whichever comes first.
`rayfin/.temp/` is the CLI's existing scratch directory and is covered by the scaffolded `.gitignore`, so query results — which are customer data — cannot be committed by a stray `git add`.

Two flags control this:

- `--max-inline-bytes <bytes>` — change the threshold. `0` restores the old behavior and always prints the result in full.
- `--output-file <path>` — always write the full result to `<path>`, whatever its size. The inline result is still shown in full unless it also crosses the threshold.

```json
{
  "status": "ok",
  "connector": "mymodel",
  "operation": "executeQuery",
  "output": { "status": "success", "table": { "columns": [], "rows": [] } },
  "outputFile": "/path/to/app/rayfin/.temp/invoke-results/2026-09-21T101500.123Z-mymodel-executequery-1a2b3c4d.json",
  "outputBytes": 4821004,
  "outputTruncated": true,
  "previewItems": 20
}
```

If the file cannot be written, the command still succeeds with a truncated `output` and warns — falling back to printing the whole payload would recreate the problem this exists to prevent.
An explicit `--output-file` that cannot be written fails instead, because the caller named that path.

## Examples

```bash
# Inline payload, positional args
npx rayfin connector invoke mymodel executeQuery --input '{"query":"EVALUATE TOPN(10, Sales)"}'

# Same thing with flag forms and a payload file
npx rayfin connector invoke --name mymodel --operation executeQuery --file ./payload.json

# Machine-readable (no --verbose allowed alongside)
npx rayfin connector invoke mymodel executeQuery --input '{"query":"EVALUATE TOPN(1, Sales)"}' --json

# Send the full result to a known path instead of hunting for the spill file
npx rayfin connector invoke mymodel executeQuery --file ./payload.json --output-file ./result.json --json
```

## Errors

| Message                                                          | Fix                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Missing required connector invoke arguments`                    | Supply both the connector name and the operation.                                     |
| `Choose exactly one payload source` / `Missing payload input`    | Pass exactly one of `--input` or `--file`.                                            |
| `Input file must be inside the project`                          | Use a relative path under the project root.                                           |
| `Operation "<op>" is not allowed for connector "<name>"`         | Check the connector's `operations:` in `rayfin.yml`, or the type's allowlist.         |
| `missing workspaceId/itemId in rayfin.yml`                       | Add both under `config:`, or re-run [`connector add`](./add.md).                      |
| `Access token has the wrong audience for the Power BI query API` | Unset or replace `RAYFIN_TOKEN`, or re-run without `--json` to consent interactively. |
| `No remote endpoint configured`                                  | The non-semantic-model transport needs a deployed item — run `npx rayfin up` first.   |
| `Invalid --max-inline-bytes value`                               | Pass a non-negative whole number of bytes, or `0` to always print inline.             |
| `Could not write the result to <path>`                           | Point `--output-file` at a writable path, or drop the flag to use the default location. |
