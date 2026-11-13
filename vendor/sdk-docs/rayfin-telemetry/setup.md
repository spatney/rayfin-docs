---
sidebar_position: 2
---

# Enable and deploy Observability

## Prerequisites

- A Rayfin project with a working CLI installation and `rayfin/rayfin.yml`.
- An approved Fabric workspace and permissions to deploy the AppBackend.
  Telemetry queries currently require **Write** permission on the item, not just anonymous application access.
- Fabric service-side telemetry enablement for the target tenant/workspace.
  The service evaluates `BaaS_EnableTelemetryService` for provisioning and queries.
  A Builder cannot enable this gate by setting a local environment variable.
- For the hosted frontend workflow, server-written runtime configuration on static deploy.
  This is separately gated by `BaaS_WriteRuntimeConfigOnStaticDeploy`.
- For browser instrumentation, a supported modern browser and an SDK-compatible frontend bundler.

These requirements apply to the actual target environment.
Do not assume a configuration that works in one Daily, PPE, or production workspace is enabled in another.
No specific environment is asserted to be rolled out by this guide.
Use the project's existing Fabric login/environment setup; there is no new telemetry-specific environment selector.

## Enable and deploy

Telemetry CLI commands are available without setting `RAYFIN_FEATURE_FLAGS`.
This does not enable collection or bypass the Fabric service-side prerequisites.
From inside the project, enable the service:

```bash
npx rayfin telemetry enable
```

This updates the existing configuration with:

```yaml
services:
  telemetry:
    enabled: true
```

Keep the project's other service settings.
Do not put the allocated resource ID, provisioning reference, connection string, or credentials in this block.
The command changes local configuration only; it does not provision resources.
Repeating it when already enabled makes no change.

Authenticate and preview the approved target before deployment:

```bash
npx rayfin login
npx rayfin up --dry-run --workspace-id <approved-workspace-id>
npx rayfin up --workspace-id <approved-workspace-id>
```

Use the workspace approved for this app; the placeholder is not a real workspace ID.
Existing projects can use their recorded deployment target, but confirm it before changing cloud resources.
The dry run is a deployment preview, not proof that the remote feature gate, provisioning, or ingestion works.

## What deployment does

1. The CLI sends the service settings to the Fabric backend.
2. For enabled telemetry without complete allocated state, the backend checks the service gate and acquires the project's observability resource.
3. It persists the Application Insights resource ID, connection string, and provisioning-service reference against the app.
   Complete existing allocation is reused.
4. The connector-function bootstrapper installs the telemetry query adapter and grants its managed identity telemetry access.
   A query does not provision a missing adapter.
5. When app functions are enabled, their telemetry configuration is reconciled with the app's allocated destination.
6. When server runtime-config writing is enabled for static deploy, the backend writes the allocated connection string into the hosted `rayfin.config.json`.

The CLI's pre-build runtime-config file alone does not contain the allocated connection string.
Do not treat a successful local build, YAML update, or deployment response as proof that the browser has received it.
Check the **served** file after deployment using the [connection-string guide](./connection-string.md).

## Verify setup

1. Check that `services.telemetry.enabled` is `true`.
2. Open the deployed app and verify the served runtime configuration contains `applicationInsightsConnectionString`.
3. Initialize the SDK and emit the [frontend smoke test](./frontend.md#emit-and-flush-a-test-signal).
4. Query that signal using the commands in [verification](./troubleshooting.md#verify-emission-and-ingestion).

If the connection string is absent, the local request to enable telemetry is not sufficient evidence of provisioning.
Confirm the service gates and app-associated resource with the environment operator.

## Disable Observability

> **Destructive on the next deployment**
> Disabling locally does not immediately delete anything.
> The next `rayfin up` deletes the allocated observability resource.
> Previously collected telemetry will no longer be available through that resource.
> Re-enabling creates a new empty resource; it does not recover that history.

After explicit approval of that consequence:

```bash
npx rayfin telemetry disable
npx rayfin up --dry-run --workspace-id <approved-workspace-id>
npx rayfin up --workspace-id <approved-workspace-id>
```

The local command sets `services.telemetry.enabled: false` when a change is needed.
Disabling an already-disabled or absent setting is a no-op.
The backend clears the allocated resource state, and the runtime-config writer omits the connection string for disabled telemetry.
For functions that are or were enabled, disabling previously-enabled telemetry restores their default telemetry configuration before deleting the observability resource.

Stop frontend collection as well.
An already-open page can retain its previous connection string and initialized SDK until shutdown or reload; changing YAML is not a browser kill switch.
Follow the SDK lifecycle guidance in [frontend integration](./frontend.md#production-considerations).
