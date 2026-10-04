---
sidebar_position: 1
---

# connector search

```bash
npx rayfin connector search [query] [--workspace-id <id> --type <types> | --all-workspaces --type <types>] [--limit <n>] [--json]
```

> **`kusto` authoring is held in this release**, so search does not return KQL databases and `--type kusto` is not accepted. Search exists to feed `connector add`, which would refuse the type — surfacing a source the Builder could not then attach. See [Connectors](./index.md).

`connector search` finds Fabric data sources — warehouses, SQL databases, Lakehouses, and semantic models — that the signed-in identity can add as connectors, before you know exact workspace or item IDs.

Use it to find candidates for [`connector add`](./add.md). It never touches app data itself.

## Scope resolution

The search scope is resolved in priority order:

1. `--workspace-id <id>` — search exactly one workspace. **Requires** `--type`: without it, every discoverable item type would be fetched with a separate request to that workspace.
2. `--all-workspaces` — tenant-wide scan across every workspace the identity can access. **Requires** `--type` (the only server-side filter) to keep the scan bounded.
3. No scope flag, run inside a Rayfin project with deployments — defaults to the union of every workspace recorded in the project's deployments registry (dev, prod, and so on), without switching the active deployment. This is the only scope that does **not** require `--type`.

Only one of `--workspace-id` and `--all-workspaces` may be given. Outside a Rayfin project with zero deployments, one of them is required; omitting both fails with `workspace scope is required`.

## Filtering

| Flag                                       | Purpose                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[query]` (positional) or `--query <text>` | Case-insensitive name filter. Omit to list every connectable source in scope. `--query` wins if both are given.                                      |
| `--type <types>`                           | Comma-separated subset of connector types, for example `fabric-warehouse,fabric-sqldatabase`. Required with `--workspace-id` and with `--all-workspaces`.                      |
| `--limit <n>`                              | Caps the rows shown. Ignored in interactive mode, where the picker paginates the full result set instead; applies only to plain and `--json` output. |

## Output modes

- **Interactive** (default on a TTY) — a paginated picker. Page size comes from `RAYFIN_CONNECTOR_SEARCH_PAGE_SIZE`, default 30. Picking a source runs a pre-flight access check (SQL endpoint, Kusto endpoint, or semantic model probe, depending on type) before handing off to [`connector add`](./add.md); a failed check re-shows the picker instead of aborting. `--yes` and `--verbose` are forwarded to the `connector add` it runs.
- **Plain** (non-TTY) — prints the list and exits, with no prompt.
- **`--json`** — a machine-readable envelope on stdout: `{status, query, scope, count, sources}`. Each row carries `workspaceId`, `itemId`, and `connectorType`, plus `suggestedName` (the sanitized display name to use as the connector name) and `addCommand` (the exact `rayfin connector add …` string to run). Skips both the picker and the access-check pre-flight.

Duplicate-looking entries — for example a SQL Database and its SQL-analytics-endpoint twin sharing a workspace and display name — are grouped visually next to each other in interactive and plain output only. They are never deduplicated, and `--json` always returns the canonical, ungrouped order.

The SQL-endpoint-permissions note ("Schema discovery for SQL-based connectors requires SQL endpoint permissions") only prints when at least one result is a SQL-dialect connector type — never for a semantic-model-only result set. (It would also not print for a Kusto-only set, once Kusto authoring ships.)

## Examples

```bash
# Query text as a positional argument, scoped to one workspace (--type is required with --workspace-id)
npx rayfin connector search "sales" --workspace-id <ws-id> --type fabric-warehouse

# Tenant-wide scan, narrowed to one or more types (--type is required with --all-workspaces)
npx rayfin connector search --all-workspaces --type fabric-warehouse,fabric-sqldatabase

# No scope flag inside a deployed project — searches every deployment workspace, no --type needed
npx rayfin connector search

# Machine-readable output, capped to 5 rows, skips the interactive picker
npx rayfin connector search --workspace-id <ws-id> --type fabric-warehouse --json --limit 5
```

## Errors

| Message                                              | Fix                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Command incomplete: workspace scope is required`    | No `--workspace-id` or `--all-workspaces` and no deployments found. Pass one of those flags.                      |
| `--type is required with --all-workspaces`           | Add a `--type` filter to bound the tenant-wide scan.                                                              |
| `--type is required with --workspace-id`             | Add a `--type` filter so a single request is made instead of one per discoverable item type.                      |
| `You don't have the required permission on <source>` | The pre-flight access check failed during the interactive add handoff. Pick a different source or request access. |
