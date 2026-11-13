---
sidebar_position: 7
---

# Telemetry

For the end-to-end setup, allocated connection string, frontend OpenTelemetry example, and troubleshooting, see the versioned [Observability documentation](/docs/ts-sdk/rayfin-telemetry) in `@microsoft/rayfin-telemetry`.
When that package is installed, retrieve its entry page with `npx rayfin docs get --id rayfin-telemetry:index.md`.
It also provides the browser initializer at `@microsoft/rayfin-telemetry/browser`.

Application telemetry is configured under `services.telemetry` in `rayfin.yml`.
The commands are available without setting `RAYFIN_FEATURE_FLAGS`.
Collection remains opt-in and requires Fabric service-side telemetry enablement.

Enable telemetry:

```bash
npx rayfin telemetry enable
```

Disable telemetry:

```bash
npx rayfin telemetry disable
```

Both commands support `--output <interactive|plain|json>`, `--json`, and `--verbose`.
Do not combine verbose mode with JSON output.
They update local configuration only; deploy with `rayfin up` to apply the change.

> **Destructive on deployment:** disabling telemetry and running `rayfin up` deletes the allocated observability resource.
> Previously collected telemetry will no longer be available, and re-enabling creates a new empty resource.

The commands update only this setting:

```yaml
services:
  telemetry:
    enabled: true
```

## Query telemetry

For collection-aware issue investigations, field discovery, and correlation, follow the versioned [querying and debugging runbook](/docs/ts-sdk/rayfin-telemetry/querying-and-debugging).

Enable telemetry and run `rayfin up` before querying so the deployed app has an allocated Application Insights resource:

```bash
npx rayfin telemetry enable
npx rayfin up
```

Run a KQL query by passing it as a quoted argument.
Rayfin queries the **Application Insights resource allocated to your application**, not its backing Log Analytics workspace.
Use the Application Insights table names, such as `traces`, `customEvents`, and `pageViews`.
Use resource-scoped column names such as `timestamp`, `message`, and `customDimensions`.

```bash
npx rayfin telemetry query "traces | project timestamp, message | order by timestamp desc | take 20"
```

The query command supports:

| Option                                | Description                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `--timespan <duration>`               | Limits the query window using an ISO 8601 duration, such as `PT1H`.                              |
| `--max-rows <count>`                  | Limits the result to between 1 and 10,000 rows.                                                  |
| `--output <interactive\|plain\|json>` | Selects the output mode.                                                                         |
| `--json`                              | Returns one JSON object containing `status`, `count`, and `rows`. Equivalent to `--output json`. |

Without JSON output mode, each result row is written as one JSON object per
line. This allows results to be processed incrementally:

```bash
npx rayfin telemetry query "exceptions | project timestamp, outerMessage | order by timestamp desc" \
  --timespan PT1H \
  --max-rows 100
```

For an application with page-view collection enabled:

```bash
npx rayfin telemetry query "pageViews | project timestamp, name, duration | order by timestamp desc | take 20"
```

Provisioning and querying require service-side telemetry enablement for the target Fabric workspace.
Querying currently requires item Write permission.
Local configuration does not enable the service-side gate.

Rayfin selects the Application Insights resource allocated to the deployed app on the server.
The command does not accept a Log Analytics workspace ID or an Application Insights resource ID and cannot select an arbitrary telemetry resource.
If authentication is required, run `rayfin login` and retry.

Rayfin CLI usage telemetry is separate and remains controlled by `RAYFIN_TELEMETRY_OPTOUT`.
