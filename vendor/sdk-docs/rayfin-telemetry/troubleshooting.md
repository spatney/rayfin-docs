---
sidebar_position: 5
---

# Verify and troubleshoot Observability

## Verify emission and ingestion

Test each stage independently:

1. **Allocation:** confirm the app has enabled telemetry and the served runtime config contains its allocated connection string.
2. **Emission:** initialize through `initTelemetry` once, emit `observability.smoke_test` once, and flush as shown in the [frontend example](./frontend.md).
3. **Transport:** inspect the hosted app's browser network panel for a POST to the allocated ingestion destination ending in `/v2/track`.
   Check the status and response body for rejected or partially accepted records.
   A queued request or successful `forceFlush()` alone is not ingestion proof.
4. **Ingestion:** allow for ingestion latency, then query the deliberate signal.
5. **Association:** verify the selected deployment targets the intended app and the event's `customDimensions` contain the expected workspace/item attributes.
   Confirm the persisted Application Insights component ID with the environment operator when the allocated Azure resource itself needs verification.

With the correct deployment active:

```bash
npx rayfin telemetry query "customEvents | where name == 'observability.smoke_test' | project timestamp, name, customDimensions | order by timestamp desc | take 20" --timespan PT1H --max-rows 20 --json
```

JSON output is one object containing `status`, `count`, and `rows`.
Without JSON mode, rows stream as newline-delimited JSON.
`--max-rows` accepts integers from 1 to 10,000.
`--timespan` is an ISO 8601 duration, such as `PT1H`.
An empty successful result means no matching rows were returned, not that emission or ingestion was verified.

Rayfin queries the allocated Application Insights component, not the backing Log Analytics workspace.
Use the [Application Insights schema](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete#types-of-telemetry): `traces`, `customEvents`, `exceptions`, and `pageViews`, with columns such as `timestamp`, `name`, `message`, `customDimensions`, and `duration`.
These table and column names differ from the Log Analytics workspace schema even when the component is workspace-based.
The frontend example enables page views but intentionally omits dependency collection to control ingestion volume.
Use the custom event above for the deliberate smoke test; missing dependency records are expected with this configuration.

## Diagnose application issues

For symptom-to-signal coverage, bounded issue-oriented KQL, field discovery, and operation/session correlation, follow [Query and debug application telemetry](./querying-and-debugging.md).
Confirm the target and time window, inspect collection coverage, choose a bounded query, correlate actual records, and report findings alongside collection gaps.
The default browser setup does not automatically collect exceptions, console logs, or Fetch/XHR dependencies, and does not instrument incoming server requests.
Explicit app logs, events, and customer-authored spans may provide additional coverage; inspect their emitters and deployed settings.
An empty failure query means no matching collected records, not proof that the app had no failures.
Do not enable additional collection without the required volume/privacy decision.

## Query permissions and resource scope

The Rayfin query endpoint currently authorizes item **Write** permission.
It selects the allocated Application Insights resource on the server and invokes the provisioned telemetry adapter with a server-side identity.
The adapter's managed identity needs access to the backing telemetry logs.
A browser connection string does not grant query access.
Neither anonymous app access nor direct Azure reader access automatically satisfies the Fabric management endpoint's permission checks.

The command does not accept an Application Insights resource ID or a Log Analytics workspace ID as a target override.
Do not expose adapter credentials or query tokens to the frontend as a workaround.
If the adapter or its access grant is missing, redeploy through the supported setup path or involve the environment operator.
Repeated queries do not create the missing adapter.

## Common failures

| Symptom | Check and next action |
| --- | --- |
| `telemetry` is not a known CLI command | Check the version of the CLI used by your project and upgrade to a release that includes ungated telemetry commands. The commands register unconditionally, without setting `RAYFIN_FEATURE_FLAGS`. Application YAML does not control command registration. |
| Enable succeeds, but no connection string appears | Enable updates local YAML only. Deploy, verify service provisioning enablement and server runtime-config writing, then inspect the served file. |
| A bundled/pre-build config has no connection string | The CLI does not populate the allocated value in its pre-build runtime file. Verify the server-written config at the deployed hosting URL. |
| Connection string still points to a source stage | Remove build-time/source-stage defaults. Read the target runtime config, inspect caches and service workers, and reload the page. |
| Local frontend has no connection string | No automatic telemetry-specific frontend environment mapping is established by this workflow. Do not copy a production string into a promoted bundle; use an explicitly approved development destination if testing locally. |
| SDK initialized, but no requests appear | Verify `azureMonitor.connectionString` is passed, the test ran after initialization, providers were not initialized twice, the instance is not shut down, and sampling is not zero. |
| Helper returns `undefined` and warns | Inspect the existing client's runtime configuration and deployed connection string. The helper does not load a config file or create a client. |
| Helper warns that new options are ignored | Initialization is page-scoped, including across hot reload. The first configuration wins; reload to change options. |
| Helper rejects a different destination/app or a call after shutdown | Reload the page and initialize with the intended client's runtime configuration. Do not delete ownership state or start a second SDK instance. |
| Requests go to `/v1/traces` on the AI host | This is an OTLP/Azure Monitor protocol mismatch. Use the built-in Azure Monitor destination or a separately configured compatible collector. |
| Ingestion returns 400 or rejects records | Check the complete connection string, valid UUID instrumentation key, endpoint, SDK version, and response details. A workspace ID, ARM ID, Rayfin publishable key, or key-only string is not the allocated full connection string. |
| Ingestion returns 401/403 | Check the resource's ingestion/network policy. The example does not implement Entra-authenticated browser ingestion; never publish a privileged credential to bypass it. |
| Browser blocks transport | Inspect CSP `connect-src`, browser extensions, network restrictions, and any cross-origin instrumentation/preflight errors. |
| `DEPLOYMENT_NOT_CONFIGURED` | Select/establish the intended deployment with `rayfin up`; verify the recorded target before a remote write. |
| `AUTHENTICATION_REQUIRED` or expired login | Run `npx rayfin login`, then retry with the intended environment and identity. |
| `FEATURE_NOT_ENABLED` | The target workspace's service-side gate is off. A local flag cannot change it; involve the environment operator. |
| `TELEMETRY_NOT_ENABLED` | Enable `services.telemetry` and deploy the change before querying. |
| `TELEMETRY_QUERY_UNAVAILABLE` | The allocated resource or provisioned query adapter is missing. Run the supported deployment path and investigate provisioning failures. |
| Query permission denied | Verify Fabric item Write permission and the adapter identity's telemetry access separately from Azure portal permissions. |
| `TELEMETRY_QUERY_FAILED` | Preserve the CLI's service status/code/request ID and investigate the adapter, permissions, or query with the operator. Do not send credentials or raw customer data in the escalation. |
| Successful query returns no rows | Check time window, table schema, exact event name, sampling, target component, and ingestion latency. Do not report successful ingestion without the test record. |

## Operational limitations

- No blanket Daily/PPE/MSIT/production availability or environment-specific setup beyond the implemented gates is verified here.
- Browser export is client-controlled and can be blocked, sampled, interrupted, or falsified.
  It is not an audit log or guaranteed-delivery system.
- Internal Fabric metrics/traces are separate from the customer's resource.
  Do not assume enabling this service makes all platform telemetry queryable by the Builder.
- The browser distribution does not initialize a metrics provider.
  OTLP collectors and custom pipelines are not provisioned by this feature.
- Disabling and deploying deletes the observability resource; re-enabling does not restore historical data.
- Retention, pricing, ingestion quotas, and capacity attribution are not established by these sources.
  Confirm them for the actual managed resource and environment rather than promising a free tier or retention period.
- An SDK typecheck, documentation discovery test, deployment preview, or successful deployment cannot substitute for a live emission-and-query test.

## Evidence to collect for support

Provide the installed CLI, Rayfin client, and browser SDK versions; environment; workspace/item IDs; allocation status; timestamp/time window; sanitized error code and request ID; and whether the network request was accepted.
Keep credentials, customer payloads, raw tokens, and privileged configuration out of reports.
If the resource is inaccessible to your Azure account, ask an authorized operator to verify the app's persisted telemetry reference and adapter access rather than searching unrelated resources.
