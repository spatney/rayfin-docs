---
sidebar_position: 6
---

# Query and debug application telemetry

Use this runbook to investigate an issue, not just verify that a query executes.
Rayfin queries the **Application Insights resource allocated to your application**, not its backing Log Analytics workspace.
Use resource-scoped tables such as `traces`, `customEvents`, and `pageViews`.
The [Application Insights data model](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete) describes the schema; table availability does not prove that the app collects that signal.

## 1. Confirm the target and time window

- Confirm the active Fabric deployment, app, and deployment stage.
  The server selects the allocated resource; the CLI does not accept a target resource override.
- Follow [setup](./setup.md) for service-side prerequisites.
  Querying currently requires Fabric item Write permission, not just Azure resource access.
- Record the symptom, reproduction time in UTC, and a narrow investigation window.
  The examples use the last hour; for a historical issue, replace `ago(1h)` with explicit UTC start/end filters and use a matching CLI timespan.
- Check the deployed SDK configuration, sampling, consent, initialization time, and export/ingestion health using [troubleshooting](./troubleshooting.md).
  Check deployed configuration rather than assuming it matches local source.

Run each KQL block below through the existing command:

```bash
npx rayfin telemetry query "<KQL>" --timespan PT1H --max-rows 100 --json
```

Replace `<KQL>` with the complete query as one quoted argument, preserving its string literals using the invoking shell's quoting rules.
The CLI returns `status`, `count`, and `rows`; a query failure is not an empty result.
The examples bound time and returned rows, but a row limit does not cap ingestion cost or guarantee low query scan cost.
Narrow further by observed service, event, or correlation values when available.

## 2. Establish collection coverage

Inspect the app's initialization and explicit emitters before interpreting missing rows.
The helper defaults are documented in the [frontend guide](./frontend.md#defaults-and-overrides).

| Symptom or question | Required collection and tables | What the frontend defaults establish |
| --- | --- | --- |
| Which pages were visited? | Built-in page-view collection; `pageViews` | Enabled after initialization, subject to consent, overrides, sampling, and transport. |
| Are business events changing? | App explicitly emits named OpenTelemetry log events; `customEvents` | The pipeline is configured, but business events are not generated automatically. |
| Are there error-level application logs? | App explicitly emits severity-bearing logs, or approved console instrumentation; `traces` | Explicit logs can export; console capture is not installed. |
| Are browser exceptions occurring? | Approved error instrumentation or explicitly emitted exception-shaped records; `exceptions` | Automatic error instrumentation is not installed. An error-severity log alone is not necessarily an exception record. |
| Are outgoing HTTP calls failing or slow? | Approved Fetch/XHR instrumentation, or appropriately annotated customer-authored spans; `dependencies` | No automatic HTTP collection. A manual span is not necessarily an HTTP call. |
| Are incoming server requests failing or slow? | Server-side request instrumentation exporting to this resource; `requests` | The browser helper does not collect incoming server requests. Functions destination configuration alone does not establish which server signals are emitted. |
| What happened in one operation or session? | Populated `operation_Id` or `session_Id` on relevant records | Session context is enabled, but IDs and cross-service context propagation must be verified in actual rows. |

Do not silently enable extra instrumentation to make an investigation possible.
Error, console, and HTTP collection require an explicit privacy/volume decision, especially for a constrained ingestion budget.
Do not add dependency-generating examples to the default app.
New collection cannot recover historical signals that were never emitted.

### Discover fields and dimensions

Inspect the schema of each table needed for the symptom, one table at a time:

```kusto
pageViews
| getschema
| project ColumnName, DataType
| take 100
```

Then inspect a bounded sample to establish whether records and correlation fields are present:

```kusto
pageViews
| where timestamp >= ago(1h)
| project timestamp, name, duration, operation_Id, session_Id, cloud_RoleName
| order by timestamp desc
| take 20
```

Repeat with the relevant table and its discovered columns; do not assume every table has identical fields.
Use `cloud_RoleName` only after observing the deployed service name.
An empty table, a missing table, a permission failure, and a query syntax error are different outcomes.

Discover custom-dimension keys without dumping their values:

```kusto
customEvents
| where timestamp >= ago(1h)
| top 100 by timestamp desc
| project keys = bag_keys(customDimensions)
| mv-expand key = keys
| summarize sampledRecords = count() by key = tostring(key)
| top 30 by sampledRecords desc
```

This samples keys from at most 100 records; it is not a complete schema or event count.
Never assume an app-specific key, event name, deployment version, customer ID, or test-run ID exists.
The helper's Fabric resource attributes are not automatically copied into every record's `customDimensions`.
Discover keys first, confirm their meaning in the emitter, then use an exact filter such as `tostring(customDimensions['<observed-key>']) == '<observed-value>'`.
Inspect dimension values only when necessary and authorized; redact personal data, tokens, URLs, and payloads from reports.

## 3. Choose an issue-oriented query

### Recent page views

Requires page-view collection for the affected time window.
These are observed navigations, not a count of all authenticated users or proof of successful business actions.

```kusto
pageViews
| where timestamp >= ago(1h)
| project timestamp, name, duration, operation_Id, session_Id
| order by timestamp desc
| take 50
```

### Exceptions and error logs

Run the exception query only when exception collection is established:

```kusto
exceptions
| where timestamp >= ago(1h)
| summarize observedRecords = count(), lastSeen = max(timestamp) by type, outerMessage
| top 20 by observedRecords desc
```

For explicitly emitted error logs or approved console capture:

```kusto
traces
| where timestamp >= ago(1h) and severityLevel >= 3
| project timestamp, severityLevel, message, operation_Id, session_Id
| order by timestamp desc
| take 50
```

Application Insights severity levels 3 and 4 are Error and Critical.
Messages can contain customer data; share sanitized summaries rather than raw exception text or stacks.
No rows means no matching collected records in this scope, not that no exceptions or errors occurred.

### Failed or slow incoming requests

Requires verified server request telemetry in the app-associated resource.
The browser helper does not supply this coverage.
The two-second threshold is an investigation example, not a product SLO; choose a threshold appropriate to the app.

```kusto
requests
| where timestamp >= ago(1h)
| where success == false or duration > 2s
| project timestamp, name, success, resultCode, duration, operation_Id
| top 50 by duration desc
```

Failure status must be emitted correctly; null or unset success values are not proof of success.
Request duration is not browser page-load time.

### Failed or slow outgoing dependencies, only when collected

Use this only for an app that already has approved dependency collection.
It is a diagnostic query, not a recommendation to enable Fetch/XHR collection.
Confirm the producer and dependency `type`; customer-authored spans may represent non-HTTP work.

```kusto
dependencies
| where timestamp >= ago(1h)
| where success == false or duration > 2s
| project timestamp, name, type, target, success, resultCode, duration, operation_Id
| top 50 by duration desc
```

Do not infer an HTTP failure from a span name alone.
With the default helper configuration and no customer spans, missing dependency rows are expected.

### Event trends

First discover actual event names:

```kusto
customEvents
| where timestamp >= ago(1h)
| summarize observedRecords = count() by name
| top 20 by observedRecords desc
```

Replace the placeholder below with an observed event whose emitter and meaning you have checked:

```kusto
customEvents
| where timestamp >= ago(1h)
| where name == '<observed-event-name>'
| summarize observedRecords = count() by bin(timestamp, 5m)
| order by timestamp asc
| take 20
```

Counts are stored records, not sampling-adjusted business totals.
Sampling, blocked export, partial ingestion, and changes in instrumentation affect comparisons.
Missing time buckets mean no matching stored records, not automatically zero business activity.
Do not derive conversion or failure rates without verifying the numerator, denominator, collection coverage, and sampling semantics.

## 4. Correlate evidence

Copy a nonempty `operation_Id` from an observed row, not an invented ID.
Use only tables confirmed relevant to the investigation; remove unavailable tables rather than masking query errors.

```kusto
union withsource=signal pageViews, customEvents, traces, exceptions
| where timestamp >= ago(1h)
| where operation_Id == '<observed-operation-id>'
| project timestamp, signal, name, message, outerMessage, operation_Id, operation_ParentId, session_Id
| order by timestamp asc
| take 100
```

Add `requests` or `dependencies` only when their collection has been established.
If operation IDs are absent, do not claim a distributed trace.
Browser-to-server correlation requires compatible context propagation and server instrumentation; sharing a connection string does not establish it.

For a session-level timeline, use the same bounded query but replace the operation filter with `session_Id == '<observed-session-id>'`.
Session correlation is broader than an operation: one session may contain several unrelated actions and does not establish causality or authenticated identity.
Do not join on empty correlation IDs.
The 100-row timeline can be truncated; disclose that limit and narrow the time window before drawing ordering or completeness conclusions.

## 5. Report evidence and collection gaps

Include:

- Confirmed app, deployment stage, UTC time window, and query filters.
- Actual query outcomes, observed counts, relevant sanitized timestamps and correlation IDs, and any truncation.
- Collection settings and sources verified for that window, including sampling and known transport failures.
- Findings supported by the records, separately from hypotheses and next checks.
- What cannot be diagnosed with current coverage and the smallest approved next step.

Prefer: "No error records were returned for this app in the last hour; automatic browser error collection is not enabled, so this does not establish that no failures occurred."
Do not report "the app is healthy" solely because an exception or dependency query is empty.
With defaults alone, you cannot rule out uncaptured browser exceptions, console errors, failed/slow HTTP calls, server failures, or complete end-to-end request paths.
Page views and deliberately emitted events can still establish observed usage and specific app-reported outcomes.

Separate authorization/query failures from missing collection, and missing collection from ingestion failures.
If more evidence requires deployment or collection changes, follow the app's deployment approval workflow and [volume/privacy guidance](./frontend.md#collection-and-ingestion-volume).
Do not change the destination, enable extra collection, or redeploy merely to turn an inconclusive diagnosis into a success report.
