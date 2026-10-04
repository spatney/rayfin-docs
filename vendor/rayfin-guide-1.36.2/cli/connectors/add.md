---
sidebar_position: 2
---

# connector add

```bash
npx rayfin connector add --type <type> --workspace-id <ws-id> --item-id <item-id> [--name <name>] [--operations <ops>]
```

> **`kusto` authoring is held in this release**, so `connector add --type kusto` refuses before writing anything. Kusto examples below describe the authoring path for when it ships. See [Connectors](./index.md) for what a project that already declares Kusto can still do.

`connector add` declares a connector in `rayfin/rayfin.yml` and scaffolds its supporting files.

The CLI verifies the Fabric item, derives a connector `name` from the item's display name (override with `--name`), writes the entry to `rayfin.yml`, and scaffolds `rayfin/connectors/<name>/schema.ts`. For Category A connectors it also runs schema discovery and writes `rayfin/connectors/<name>/metadata.json` so a subset of entities can be generated later.

If you do not already know the workspace and item IDs, run [`connector search`](./search.md) first — its `--json` output includes a ready-to-run `addCommand` for each result.

## Options

| Flag                  | Required     | Purpose                                                                                                                                                                                                                 |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--type <type>`       | yes          | The connector type, for example `fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`, `kusto`, or `fabric-semanticmodel`.                                                                                    |
| `--workspace-id <id>` | yes (Fabric) | Fabric workspace ID. Must be a literal — `${VAR}` placeholders are rejected.                                                                                                                                            |
| `--item-id <id>`      | yes (Fabric) | Fabric item or artifact ID. Must be a literal.                                                                                                                                                                          |
| `--name <name>`       | no           | Connector name. Derived from the item display name when omitted.                                                                                                                                                        |
| `--operations <ops>`  | no           | Comma-separated subset of the type's allowed operations, for example `read,update`. Narrows the emitted `operations:` at add time. Omit for all allowed operations. Each value must be in the type's catalog allowlist. |
| `-y, --yes`           | no           | Auto-accept overwrite and confirmation prompts (non-interactive).                                                                                                                                                       |
| `-v, --verbose`       | no           | Verbose diagnostics.                                                                                                                                                                                                    |

## Authentication

`connector add` writes `auth.type: application` for Category A connectors: `fabric-sqlanalytics`, `fabric-warehouse`, and `fabric-sqldatabase`.
The connector accesses the data source with the app's identity rather than the signed-in end user's identity.
For per-user data-source access, explicitly set `auth.type: delegated` in `rayfin.yml` before deploying.

Category B connectors continue to require `auth.type: delegated`.
Existing declarations are not migrated, and omitting `auth.type` remains a validation error.

## Scoping operations

Without `--operations`, `connector add` writes **every** operation the catalog allows for the type. Prefer scoping at add time over hand-editing YAML afterwards:

```bash
npx rayfin connector add --type fabric-warehouse --workspace-id <ws> --item-id <item> --operations read,update
```

The resulting `rayfin.yml` entry lists operations as objects, not bare strings:

```yaml
connectors:
  - name: inventory
    type: fabric-warehouse
    config:
      workspaceId: ${WS_ID}
      itemId: ${ITEM_ID}
    auth:
      type: application
    operations:
      - name: read
      - name: update
```

Rules:

- You can narrow below the catalog default; you cannot widen above it.
- There is no `all` meta-operation — list every action explicitly.
- The host validator rejects unknown or duplicate operation names at `rayfin up` time.

## Category B connectors

For `kusto` and `fabric-semanticmodel`, `connector add` writes the `rayfin.yml` entry and generates a complete typed `schema.ts`, but there are no GraphQL entities to discover, so no entity files are generated and no row-level security applies:

- `fabric-semanticmodel` allows `executeQuery`; `kusto` allows `executeQuery` and `executeCommand`. Check `rayfin connector types --json` for the current set.
- `auth.type` must be `delegated`.
- The connector is pinned to an adapter version.
- There is no `metadata.json` entity list to generate from.

After adding, exercise the connector with [`connector invoke`](./invoke.md) rather than writing entity code.

## Installing the packages

`connector add` scaffolds files but installs nothing, and the generated `schema.ts` imports packages a fresh app does not declare.
On success the command prints the exact, version-pinned install to run:

```text
📦 Install the packages this connector needs:
   npm install @microsoft/rayfin-connector-kusto@1.35.0-alpha
```

Run it verbatim.
**Do not drop the version.** Connector packages ship in lockstep with the CLI, but their npm `latest` and `preview` tags lag the published release, so an unversioned install resolves to an older connector that hard-pins its own `@microsoft/rayfin-data` — leaving two Rayfin version lines in one app.

With `--json`, the same information is available under `install`:

```json
{
  "install": {
    "packages": ["@microsoft/rayfin-connector-kusto@1.35.0-alpha"],
    "command": "npm install @microsoft/rayfin-connector-kusto@1.35.0-alpha"
  }
}
```

## Re-adding an existing connector

Running `connector add` against a name already in `rayfin.yml` refreshes the declaration.
It prompts before overwriting, or requires `--yes` when non-interactive.
This rewrites `auth.type` to the catalog default, so reapply an explicit `delegated` setting for a Category A connector after re-adding it if needed.

Your generated entity files under `rayfin/connectors/<name>/` are **preserved**.
Only `metadata.json` is rewritten, by schema discovery.
The hand-authored aggregate `schema.ts` is preserved too, unless you pass `--yes` — which opts in to overwriting it with a fresh placeholder.

To start from a clean directory instead, use [`connector remove`](#related-commands) first.

## When schema discovery fails

Schema discovery is best-effort.
If it fails, the connector is still written to `rayfin.yml` and the command still exits `0` — you can retry discovery later by re-running `connector add`.

The failure is reported as a warning with a recovery hint, and under `--json` as a `schemaDiscovery` object:

```json
{
  "status": "success",
  "action": "connector.add",
  "schemaDiscovery": {
    "status": "failed",
    "reason": "login",
    "error": "The data source rejected the login for connector \"inventory\". ...",
    "recovery": "Confirm your account has read access to item <id> in workspace <id> — that is the usual cause. If it does, run `rayfin login` to refresh your session and retry."
  }
}
```

`schemaDiscovery` is present only for Category A connectors, which are the only ones that run discovery.
Top-level `status` stays `success` because the connector was added; check `schemaDiscovery.status` to branch on discovery specifically.

| `reason` | Meaning |
| --- | --- |
| `permission` | The data source explicitly denied the read. Someone must grant your account access. |
| `login` | The login was rejected without saying why. Usually missing access to the item; occasionally a stale CLI session. |
| `auth` | The control plane rejected your token. Run `rayfin login`. |
| `unknown` | Anything else — the raw driver message is in `error`. |

## Related commands

```bash
npx rayfin connector list --json
npx rayfin connector list --verbose

# Removes the rayfin.yml entry AND the rayfin/connectors/<name>/ directory,
# including any entity files you generated.
npx rayfin connector remove <name> [--yes]
```

`--json` and `--verbose` are mutually exclusive and cannot be combined.
