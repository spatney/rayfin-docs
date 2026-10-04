---
sidebar_position: 9
---

# Eventhouse (`kusto`) usage guide

> **Moved.** This usage guide now ships **inside the connector package**,
> version-locked to the `kusto` connector the Builder actually installed — so the
> streaming model, KQL shaping, safe query construction, and result handling can
> never drift from the CLI. It is fetched on demand with `packageVersion`
> provenance.
>
> Read it from `@microsoft/rayfin-connector-kusto`:
>
> - MCP: `search_docs` / `discover_packages`
> - CLI: `rayfin docs search "<term>"` (module `rayfin-connector-kusto`)
> - Source: `@microsoft/rayfin-connector-kusto/assets/docs/`
>
> The shared function-bridge mechanics — `connector add`, the generated
> `rayfin.yml` and `schema.ts`, and the `client.connectors.<name>` call — stay in
> the [Category B guide](./category-b-function-bridge.md).
