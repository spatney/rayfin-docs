---
sidebar_position: 4
---

# Frontend integration with OpenTelemetry

The `@microsoft/rayfin-telemetry/browser` entry point provides `initTelemetry`.
It reads configuration supplied by the app's existing Rayfin client and initializes Microsoft's [`@microsoft/opentelemetry-browser`](https://www.npmjs.com/package/@microsoft/opentelemetry-browser).
The underlying SDK is beta; review the [upstream documentation](https://github.com/microsoft/opentelemetry-distro-browser) before changing versions.

## Supported pipeline

```text
Application page views and custom-event log records
    -> Rayfin initializer configures Microsoft's OpenTelemetry browser distribution
    -> built-in Azure Monitor exporters
    -> allocated IngestionEndpoint /v2/track
    -> the app's Application Insights component
```

The helper passes `runtimeConfig.applicationInsightsConnectionString` to `azureMonitor.connectionString`.
The distribution converts OpenTelemetry records into Azure Monitor ingestion envelopes.
Reading a connection string from `RayfinClient` without initializing the SDK sends nothing.
Rayfin does not provision a browser OTLP collector.
**Do not point an OTLP exporter at the Application Insights ingestion endpoint:** OTLP/HTTP `/v1/traces` and `/v1/logs` are not Azure Monitor `/v2/track`.

## Install compatible dependencies

From the app root, install the Rayfin package matching your Rayfin CLI release in the Universal App's frontend workspace, then list its pinned peers:

```bash
npm install -w @rayfin-app/frontend @microsoft/rayfin-telemetry
npm view @microsoft/rayfin-telemetry peerDependencies
```

Install `@microsoft/opentelemetry-browser`, `@opentelemetry/api`, `@opentelemetry/api-logs`, and `@opentelemetry/resources` in the same workspace at the exact versions listed, for example `npm install -w @rayfin-app/frontend @opentelemetry/api@<version>`.
For a standalone frontend, omit `-w @rayfin-app/frontend` and run from that frontend package.
The application also needs its existing compatible `@microsoft/rayfin-client` installation.
The Rayfin package must be published to the configured Microsoft package feed before the command can succeed.
It declares the browser distribution and listed OpenTelemetry packages as pinned peer dependencies, not bundled copies, so the app's SDK versions remain visible.
`@microsoft/rayfin-client` is a peer for the shared runtime-configuration type; the helper does not create a client or import its runtime.
Use a browser bundler and initialize only in client code, not during server rendering.
The underlying distribution supports current stable Chrome, Edge, Firefox, Opera, and Safari; Internet Explorer/ES5 targets are unsupported.

## Initialize once from the existing client

First [enable and deploy telemetry](./setup.md) and verify the [served connection string](./connection-string.md).
In the Universal App's existing client startup path, outside React render/effect code and after any required consent:

```typescript
import { initTelemetry } from '@microsoft/rayfin-telemetry/browser';
import { getRayfinClient } from '@/lib/rayfin-client';

const client = await getRayfinClient();
const telemetry = await initTelemetry({
  runtimeConfig: client.runtimeConfig,
  serviceName: 'my-fabric-app-frontend',
});
```

Continue the existing application startup after this awaited call, before app code that should emit telemetry runs.
Preserve the template's authentication gate and composable client bootstrap.
Do not create another Rayfin client or replace the startup module just to enable telemetry.
For other frontends, use the existing client's `runtimeConfig` in the same way.

`runtimeConfig` is a required property: the helper cannot discover an app-specific client automatically and does not fetch `/rayfin.config.json` itself.
Its value may be `undefined` if the existing client has no runtime configuration.
A missing or blank connection string logs a visible warning and returns `undefined` without initializing the SDK.
Configuration absence is not cached, so a later call with valid configuration can initialize.
SDK initialization failures reject the returned promise; use the application's developer error path rather than reporting success.

## Defaults and overrides

| Setting | Default |
| --- | --- |
| Azure Monitor destination | The existing client's `applicationInsightsConnectionString`; no independent destination override |
| `service.name` | `serviceName`, or `rayfin-app-frontend` if omitted |
| Fabric diagnostic attributes | `fabric.workspace.id` and `fabric.item.id`, when present in runtime configuration |
| Page views | Enabled |
| Sessions and SDK-managed user context | Enabled |
| Browser storage | Enabled, with the upstream empty storage-key prefix |
| Previous-page visit timing | Disabled; opt in with `pageView.autoTrackPageVisitTime` |
| Customer SDK Stats | Disabled; opt in with `azureMonitor.sdkStats` |
| Configuration synchronization | Disabled; requires explicit `extensionConfig.AppInsightsCfgSyncPlugin` configuration |
| Optional instrumentations | Empty: no automatic Fetch/XHR, console, or error instrumentation |
| Sampling | 100% for initial validation; choose a production value for the actual volume budget |

The Fabric attributes are diagnostic metadata, not authorization fields.
The SDK maps selected resource attributes such as `service.name` to Azure Monitor fields; it does not automatically copy arbitrary resource attributes into event `customDimensions`.
The smoke test below attaches the Fabric IDs as event attributes explicitly so they can be checked in query results.
SDK-managed user context does not mean the app should attach an authenticated identity, email, or other personal data.
Session and user identity persistence require the applicable consent/storage review.

The options expose the underlying browser SDK settings, including `azureMonitor` export policies, except its `connectionString`.
The destination always comes from the existing client's runtime configuration, even if a JavaScript caller supplies another connection string.
For example, use this **instead of** the initialization call above, not as a second call to reconfigure an active instance:

```typescript
const telemetry = await initTelemetry({
  runtimeConfig: client.runtimeConfig,
  serviceName: 'my-fabric-app-frontend',
  samplingPercentage: 20,
  storage: { enabled: false },
  session: { persist: false, inactivityTimeout: 1800, maxDuration: 86400 },
  azureMonitor: { disableBeacon: true },
  redactQueryParams: ['checkoutToken'],
});
```

Nested `session`, `userContext`, and `pageView` overrides preserve other defaults.
`storage.enabled: false` blocks SDK-managed browser storage access, including later identity controls and the unsent-telemetry buffer, without disabling telemetry collection or erasing previously stored data.
Sessions and explicitly supplied authenticated identity remain in memory; managed anonymous identity is disabled.
Alternatively, `storage.namePrefix` isolates this app's SDK storage keys on a shared origin without migrating or deleting older unprefixed data.
Session lifetimes use seconds; the supported `sessionRenewalMs` and `sessionExpirationMs` aliases use milliseconds.
Native session durations of zero disable expiration, whereas alias values of zero restore the upstream defaults.
`azureMonitor.disableBeacon` disables only the unload `sendBeacon` fallback; keepalive delivery remains available.
`azureMonitor.sdkStats: { enabled: true }` opts into additional npm-only customer delivery statistics; review its volume and privacy implications before enabling it.
`pageView.autoTrackPageVisitTime: true` opts into a separate previous-page `PageVisitTime` custom metric, not a general OpenTelemetry metrics pipeline.
A supplied OpenTelemetry `resource` merges over the standard resource attributes, allowing explicit attribute overrides.
Advanced SDK options such as processors and instrumentations are passed through; any additional collection needs a separate volume/privacy decision.
For what can and cannot be diagnosed with these defaults, use the [collection-aware query runbook](./querying-and-debugging.md#2-establish-collection-coverage).

## Emit and flush a test signal

Custom telemetry uses standard OpenTelemetry APIs, not a Rayfin-specific event wrapper.
With the startup handle above, emit the deliberate smoke test once in a development/validation path:

```typescript
import { logs } from '@opentelemetry/api-logs';

if (telemetry) {
  logs.getLogger('my-fabric-app-frontend').emit({
    eventName: 'observability.smoke_test',
    attributes: {
      'test.synthetic': true,
      ...(client.runtimeConfig?.workspaceId
        ? { 'fabric.workspace.id': client.runtimeConfig.workspaceId }
        : {}),
      ...(client.runtimeConfig?.itemId
        ? { 'fabric.item.id': client.runtimeConfig.itemId }
        : {}),
    },
  });
  await telemetry.forceFlush();
}
```

The named log record becomes a custom event in `customEvents`.
Automatic page views are collected separately in `pageViews`.
`forceFlush()` requests export; it is not proof that the record is queryable yet.
Follow the [ingestion validation steps](./troubleshooting.md#verify-emission-and-ingestion).

## Collection and ingestion volume

The helper does not generate dependency spans or enable Fetch/XHR instrumentation.
Calling the upstream `getInstrumentations()` without options enables Fetch/XHR collection and can produce a dependency record for each captured HTTP request; it is not part of this setup.
Customers can still create spans through the standard OpenTelemetry trace API.
The default trace pipeline remains available for those explicitly created spans, which can export to `dependencies`.
The helper does not suppress customer-authored spans, but this guide deliberately avoids span examples because dependency volume can quickly consume a 100 MB telemetry budget.
Confirm the applicable quota and reset period for the target environment.

Page views, the SDK's page-load timing telemetry, and custom events also consume ingestion volume.
Do not emit the smoke-test event on every production render or request.
Review event frequency, payload size, and sampling before production use.
The browser distribution does not initialize a general-purpose metrics pipeline; a `metrics.getMeter()` call is not supported export just because web-vitals instrumentation exists.

## Repeated initialization and lifecycle

Concurrent calls share one initialization promise; later calls return the same lifecycle handle.
Ownership is stored on the browser window across module copies and hot reloads, so React Strict Mode or HMR does not create a second SDK instance.
Repeated calls warn that new options are ignored: the first successful initialization owns the page's configuration.
Changing the connection string, workspace, or item rejects instead of silently redirecting telemetry.
Reload the page to change configuration.
An initialization failure is propagated and clears ownership so a later call can retry.

The handle exposes `forceFlush()`, `shutdown()`, `userContext`, `updateCfg()`, `instrumentations`, and optional `configSync` controls from the upstream SDK.
Use runtime updates, not another initialization call, to change supported policies:

```typescript
if (telemetry) {
  await telemetry.updateCfg({
    samplingPercentage: 20,
    session: { inactivityTimeout: 900 },
    azureMonitor: { disableBeacon: true },
  });
}
```

`updateCfg(patch, mergeExisting = true)` returns the committed revision and changed paths.
It supports sampling, session lifetimes and their millisecond aliases, unload-beacon policy and its `onunloadDisableBeacon` alias, and `disableFetchTracking`/`disableAjaxTracking` gates for already registered HTTP instrumentations.
Omitted settings are preserved by default; passing `false` as the second argument resets omitted runtime policies to upstream defaults, not Rayfin's initialization overrides.
Explicit `samplingPercentage: undefined` restores parent-based trace sampling and disables Azure Monitor log percentage sampling.
Updates do not change the destination, resource, storage policy, session enablement/persistence, or processors.
Sampling changes affect future sampling decisions, not already sampled or queued telemetry; beacon policy applies to future fallback attempts, including for previously queued telemetry.
Invalid or unsupported updates reject without changes, and new or queued updates reject after shutdown begins.

The upstream `instrumentations` controls support lookup, pause/resume, and add/remove/replace for supported instrumentation kinds without importing or constructing modules automatically.
These controls do not enable HTTP collection under Rayfin's empty-instrumentation default.
Adding collection still needs the same privacy and volume review as startup instrumentation.
Follow the [upstream configuration reference](https://github.com/microsoft/opentelemetry-distro-browser/blob/main/docs/configuration-reference.md) for supported kinds, ownership, and startup requirements.

Configuration synchronization remains opt-in through `extensionConfig.AppInsightsCfgSyncPlugin`; the helper forwards the resulting `configSync` controls when present.
The same-realm event channel is not an authentication boundary.
HTTP configuration additionally requires an explicit trusted `cfgUrl`; no default URL or remote configuration fetch is added by Rayfin.
Review synchronization sources and provide `onError` reporting before enabling it.

Repeated shutdown calls share the same promise.
Once shutdown begins, the helper refuses reinitialization until a page reload, including when shutdown fails.
The upstream SDK does not unregister global APIs at shutdown; do not try to work around that by deleting the helper's ownership state.
Flush and shutdown failures remain visible to the caller.
Do not start another Application Insights/OTel instance alongside this helper.

## Production considerations

- **Consent and startup:** call the helper only in the browser and after required consent.
  Do not call it during server rendering.
- **Sampling:** choose `samplingPercentage` between 0 and 100 based on volume and diagnostic needs.
  It configures traces and the default Azure Monitor log pipeline; additional exporters and custom pipelines do not automatically share that filtering.
  Use 100 for the smoke test, then review the production value.
- **Privacy:** use fixed event names and bounded, reviewed attributes.
  Do not emit tokens, user content, emails, request bodies, raw errors, or identifiers without an approved data policy.
  This SDK version also attempts to send SDK statistics to `https://data.stats.monitor.azure.com/v2/track`, independently of the application's destination.
  Review its privacy notice, diagnostic/data-collection behavior, and required network destinations.
- **URLs:** review `pageView.sanitizeUrl` and `pageView.redactedQueryParams`.
  The page-view parameter list replaces its built-in list; the root `redactQueryParams` adds case-sensitive names for captured Fetch/XHR and page-view URLs/referrers while retaining the SDK's built-in signing/OAuth protections.
  URL redaction is not comprehensive application data sanitization.
- **Delivery:** allow the allocated HTTPS ingestion destination through CSP and network/ingestion policies.
  Inspect ingestion responses; browser export can be blocked, interrupted, or falsified and is not a transactional queue.
  Beta 2 mirrors unsent telemetry in bounded same-tab `sessionStorage` by default for replay on the next page load; this is best effort, not guaranteed delivery.
  Review stored payloads and use `storage.enabled: false` when SDK-managed persistence is not approved.
- **Credentials:** the connection string is public destination configuration, not a read credential.
  Never add access tokens, client secrets, or managed-identity credentials to browser exporters.
- **Environment changes:** read the existing client's target-stage runtime configuration after promotion.
  Reload the page when changing environments or after shutdown; do not keep a source-stage connection-string fallback.

SDK capabilities do not establish Fabric rollout, permission grants, resource ingestion policy, or successful ingestion for your app.
