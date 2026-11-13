---
sidebar_position: 1
---

# Observability

Rayfin Observability associates a deployed Fabric application's telemetry with an Application Insights resource allocated for that app.
Enable the service, deploy the configuration, initialize browser instrumentation with the allocated connection string, then query a deliberate test signal.
Enabling the service alone does not instrument frontend code.

> **Fabric availability**
> These pages describe implemented source behavior, not a guarantee of availability in every Fabric environment.
> Provisioning and querying require service-side enablement for the target Fabric workspace.
> Rayfin CLI commands and package discovery do not require a feature flag.
> Normal discovery is a Rayfin tooling classification, not a change to package release channels or the browser SDK's beta status.
> No environment rollout or live ingestion validation is established by this documentation.

## Start here

1. [Enable and deploy Observability](./setup.md).
2. [Retrieve the app's connection string](./connection-string.md).
3. [Integrate the Microsoft OpenTelemetry browser distribution](./frontend.md).
4. [Verify ingestion and troubleshoot](./troubleshooting.md).
5. [Query and debug application issues](./querying-and-debugging.md), including collection coverage and evidence-based diagnosis.

This documentation ships in `@microsoft/rayfin-telemetry`.
It is versioned with Rayfin and discoverable through `rayfin docs` and the MCP docs tools when installed in the project.
The `@microsoft/rayfin-telemetry/browser` entry point exports `initTelemetry` for the browser startup path.
It configures Microsoft's browser distribution using the existing Rayfin client's runtime configuration; it does not replace OpenTelemetry's signal APIs or implement another exporter.
The Universal App's Observability skill is a versionless pointer to these installed pages.

## Which telemetry belongs where

| Source | Signals and destination | What the Builder configures |
| --- | --- | --- |
| Frontend application | The browser SDK example collects page views and exports named OpenTelemetry log records as custom events to the app's Application Insights resource. Session and SDK-managed user context are enabled; dependency collection is intentionally omitted to control ingestion volume. | Install and initialize the browser SDK, review consent and collection policies, select sampling, and emit application signals. |
| App-owned deployed functions | Rayfin reconciles the functions telemetry destination with the allocated application connection string when functions and telemetry are enabled. | Enable the services and deploy. Browser initialization does not configure function logging. |
| Fabric platform/server implementation | BaaS has separate internal logging, tracing, and metrics exporters for Fabric monitoring. | Do not assume these internal signals are copied into the customer's Application Insights resource. |
| Rayfin CLI usage | Product-usage telemetry from the CLI itself. | `RAYFIN_TELEMETRY_OPTOUT` controls CLI usage reporting, not application Observability. |

The browser distribution documented here supports traces and logs.
It also offers page-view collection and optional browser instrumentations.
It does not initialize an OpenTelemetry metrics pipeline; do not assume a `metrics.getMeter()` counter will be exported by this setup.
Web-vitals instrumentation is not a promise of a general-purpose metrics exporter.

## Resource association

The Fabric backend acquires an observability resource through its provisioning service and persists its resource reference and connection string in the target app's telemetry settings.
It reuses complete allocated state on subsequent deployments rather than allocating another resource each time.
Rayfin queries the **Application Insights resource allocated to your application**, not its backing Log Analytics workspace.
Use the Application Insights table names, such as `traces`, `customEvents`, and `pageViews`.
The server selects the app's resource; callers cannot pass another resource ID to the telemetry CLI.

The connection string selects where browser telemetry is ingested.
The resolved runtime configuration also identifies the Fabric workspace and item.
The frontend example adds those coordinates as telemetry attributes for diagnosis, but they do not authorize a query or create a resource association.
Do not select an Application Insights resource by display name alone or use one from another deployment stage.

## Boundaries and current gaps

- Fabric provisioning requires both the requested application setting and the service-side gate.
  CLI commands are available without a feature flag; local configuration does not enable the service-side gate.
- Server-generated runtime configuration must be enabled for normal static deployment to deliver the allocated browser connection string reliably.
- The managed provisioning/query workflow is not established for self-hosted or Docker-only deployments.
  Bring-your-own exporters or collectors are separate setups, not a capability provisioned by this feature.
- A local frontend does not automatically receive the remote app's connection string through a new `VITE_*` variable.
  Do not infer that frontend environment mapping from the runtime-config field.
- The browser distribution is beta.
  The example pins and documents its API version rather than assuming all prereleases are compatible.
- The browser initializer wraps Microsoft's distribution; there is no automatic frontend SDK initialization, general KQL connector, or documented `rayfin observability` command.
  The implemented command group is `rayfin telemetry`.
- Disabling and deploying telemetry deletes the observability resource.
  Read the [data-loss warning](./setup.md#disable-observability) before doing this.

## Sources and ownership

The current behavior is grounded in the telemetry CLI and deployment workflows, the runtime-config client contract, and the Fabric backend's provisioning, runtime-config writer, functions reconciliation, and query authorization.
The browser integration targets the [Microsoft browser distribution](https://www.npmjs.com/package/@microsoft/opentelemetry-browser) version pinned in the package's peer dependencies, using the upstream release source rather than an OpenTelemetry design proposal.
Its [upstream documentation](https://github.com/microsoft/opentelemetry-distro-browser) owns the full SDK reference.
Historical design documents describe broader goals; they do not establish current rollout, automatic instrumentation, retention, pricing, or support for another exporter.
