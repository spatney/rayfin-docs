---
sidebar_position: 3
---

# Retrieve the Application Insights connection string

Use the connection string allocated to the **target Fabric app**, not a value copied from a source workspace or an unrelated Application Insights component.
Allocation happens during deployment with telemetry enabled, not when the local enable command runs.

## Preferred workflow: resolved runtime configuration

For a statically hosted app, the backend writes the connection string into the target app's served `rayfin.config.json`:

```json
{
  "apiUrl": "https://example.invalid/backend",
  "workspaceId": "<target-workspace-id>",
  "itemId": "<target-item-id>",
  "applicationInsightsConnectionString": "InstrumentationKey=<allocated-key>;IngestionEndpoint=https://<allocated-ingestion-host>/"
}
```

This is a shape illustration, not runnable configuration.
The resource's actual connection string may contain additional fields.
Use the entire allocated value rather than reconstructing it from the instrumentation key.

For an app already using `resolveRayfinConfig()` and `RayfinClient`, read the same resolved configuration:

```typescript
const connectionString =
  client.runtimeConfig?.applicationInsightsConnectionString;
```

In the Universal App, await the existing composable client before reading its `runtimeConfig`.
Do not create a second client or hard-code deployment coordinates just to initialize telemetry.
The client exposes the value but does not start telemetry.

To inspect the deployed file from the signed-in browser's developer console:

```javascript
const response = await fetch(
  '/rayfin.config.json',
  { cache: 'no-store' }
);
if (!response.ok) {
  throw new Error(`Runtime configuration request failed: HTTP ${response.status}`);
}
const config = await response.json();
if (!config.applicationInsightsConnectionString) {
  throw new Error('This deployment has no allocated telemetry connection string.');
}
console.log(config.applicationInsightsConnectionString);
```

Run this from the hosted app's document, not the outer Fabric portal.
Preserve the deployment's normal authentication; do not make protected hosting public for this check.
If the application has a custom base path, use the same runtime-config URL as its client.
Confirm the returned workspace and item identify the intended stage.

## Runtime configuration across environments

The backend reads the target app's persisted telemetry settings, not a connection string authored in `rayfin.yml`.
The field is omitted when telemetry is disabled or no connection string is allocated.
Normal archive deployment requires the server runtime-config writing gate; ALM import uses the same writer, and capacity-migration refresh has its own gate.

Read runtime configuration after promotion rather than embedding a connection string at build time.
Do not supply a source-stage connection string as a `resolveRayfinConfig()` default for a promoted app.
If a target has no connection string, a fallback can silently send its telemetry to the source stage.
Treat absence as disabled or not yet configured and diagnose it explicitly.

The public runtime file contains the connection string, not the Application Insights ARM resource ID.
There is no documented `rayfin telemetry connection-string` or `resource show` subcommand.

## Identify the allocated Application Insights resource

The backend persists the Application Insights component's ARM resource ID and selects it for telemetry queries.
For an ingested smoke-test event, verify the app-stage attributes through that resource-scoped query:

```bash
npx rayfin telemetry query "customEvents | where name == 'observability.smoke_test' | project timestamp, name, customDimensions | order by timestamp desc | take 1" --timespan PT1H --max-rows 1 --json
```

This needs the [service prerequisites](./setup.md).
Inspect `customDimensions` for the expected `fabric.workspace.id` and `fabric.item.id` event attributes explicitly attached by the frontend smoke test.
Setting these values on an OpenTelemetry resource alone does not make the browser SDK copy them into event properties.
These are client-supplied diagnostic attributes, not proof of the resource's ARM identity.
The query uses the Application Insights schema, not workspace tables or their `_ResourceId` column.
No rows means the event has not been verified; it does not establish that a resource was never allocated.
To identify the exact Azure resource, ask the environment operator for the app's persisted telemetry resource ID, supplying the target workspace and item IDs.
Do not guess a resource by display name.

Current allocations are normalized to an Application Insights component.
The backend also handles legacy provisioning references that identify a Log Analytics workspace, resolving the corresponding component in the same subscription and resource group with the workspace name plus `-ai`.
That is compatibility behavior, not an instruction to manually provision a similarly named component.

## Optional Azure tooling workflow

If you have Azure read access to the allocated resource, open that exact Application Insights component in the Azure portal and copy **Connection String** from its Overview page.
The backing Log Analytics workspace is a different resource; its workspace ID is not a connection string.
Fabric app permissions do not imply direct Azure subscription/resource access.
Managed resources may not be visible to a Builder's Azure account.

With Azure CLI and an operator-confirmed Application Insights ARM resource ID, PowerShell can retrieve the same ARM property:

```powershell
az login
$resourceId = '<allocated-Application-Insights-ARM-resource-id>'
az resource show --ids $resourceId --api-version 2020-02-02 --query properties.ConnectionString --output tsv
```

Replace the placeholder with the component ID, whose resource type is `Microsoft.Insights/components`.
This generic ARM command requires no Application Insights CLI extension.
An empty result, 403, or 404 is a failure to investigate, not a reason to substitute another resource.
Use the supported runtime-config workflow when direct Azure resource access is unavailable.

## Browser-safe configuration versus secrets

An Application Insights connection string and its instrumentation key identify an ingestion destination.
They are intended for browser configuration and do not grant permission to read telemetry or administer the Azure resource.
Nevertheless, browser-visible identifiers are not confidential: untrusted clients can copy them, submit misleading telemetry, or generate ingestion volume.
Apply appropriate ingestion controls, sampling, monitoring, and budget review.
Do not trust a client-supplied event as authorization or an auditable business transaction.

Never expose Azure access tokens, client secrets, managed-identity credentials, resource-management credentials, database/storage connection strings, or telemetry query credentials in browser bundles, runtime JSON, frontend environment variables, telemetry attributes, or logs.
The query adapter's managed identity remains on the server.
Do not add bearer tokens to frontend exporter configuration.
The browser SDK version used here does not supply built-in Entra-authenticated Azure Monitor ingestion; a resource that rejects local/unauthenticated ingestion cannot be made compatible by publishing a server credential.
