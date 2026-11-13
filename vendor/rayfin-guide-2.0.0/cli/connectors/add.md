---
sidebar_position: 2
---

# connector add

```bash
npx rayfin connector add --type <type> --workspace-id <ws-id> --item-id <item-id> [--name <name>] [--operations <ops>] [--auth <type>]
```

> **`eventhouse` authoring is held in this release**, so `connector add --type eventhouse` refuses before writing anything. Eventhouse examples below describe the authoring path for when it ships. See [Connectors](./index.md) for what a project that already declares an `eventhouse` connector can still do.
>
> **`fabric-dataagent` authoring is held in this release** too.
> `connector add --type fabric-dataagent` refuses before writing a YAML entry or scaffold directory, even with `--yes` or `--operations`.
> The connector remains experimental; its existing configuration and runtime contract are preserved.

`connector add` declares a connector in `rayfin/rayfin.yml` and scaffolds its supporting files.

The CLI verifies the Fabric item, derives a connector `name` from the item's display name (override with `--name`), writes the entry to `rayfin.yml`, and scaffolds `rayfin/connectors/<name>/schema.ts`. For Category A connectors it also runs schema discovery and writes `rayfin/connectors/<name>/metadata.json` so a subset of entities can be generated later.

If you do not already know the workspace and item IDs, run [`connector search`](./search.md) first — its `--json` output includes a ready-to-run `addCommand` for each result.

Connectors are for external data sources, not the app's own managed database.
Before adding a connector of any type, the CLI reads project runtime settings for the app's recorded deployments in the target workspace and rejects an item matching their managed database.
Use the app's data service for that database instead.
The check also applies when adding from the search picker or passing `--yes`.
If the settings cannot be read or the database identity cannot be verified, the command fails without changing project files; check access to the deployment and retry.
Transient network errors, throttling, and retryable server errors are retried before failing.
If settings return 404, the CLI checks the app item separately.
Only a confirmed missing app is skipped, with a warning identifying its deployment record; run `npx rayfin up` to recreate the app and refresh that record.
The CLI continues checking other recorded deployments and still rejects any confirmed managed-database match.
JSON output includes stale-record `warnings`, and ownership-check errors include a separate `recovery` field.
HTTP failures retain their status and response activity ID when available, without exposing response bodies.
Projects without a recorded deployment in that workspace can still add external connectors.

## Options

| Flag                  | Required     | Purpose                                                                                                                                                                                                                 |
| --------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--type <type>`       | yes          | The connector type, for example `fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`, `eventhouse`, or `fabric-semanticmodel`.                                                                               |
| `--workspace-id <id>` | yes (Fabric) | Fabric workspace ID. Must be a literal — `${VAR}` placeholders are rejected.                                                                                                                                            |
| `--item-id <id>`      | yes (Fabric) | Fabric item or artifact ID. Must be a literal.                                                                                                                                                                          |
| `--name <name>`       | no           | Connector name, stored in lowercase. Derived from the item display name when omitted. See [Connector names](#connector-names).                                                                                          |
| `--operations <ops>`  | no           | Comma-separated subset of the type's allowed operations, for example `read,update`. Narrows the emitted `operations:` at add time. Omit for all allowed operations. Each value must be in the type's catalog allowlist. |
| `--auth <type>`       | no           | Identity each call runs as: `delegated` (the signed-in caller) or `application` (the app owner). Omit to use the connector type's catalog default. Must be in the type's allowed auth types.                            |
| `-y, --yes`           | no           | Auto-accept overwrite and confirmation prompts (non-interactive).                                                                                                                                                       |
| `-v, --verbose`       | no           | Verbose diagnostics.                                                                                                                                                                                                    |

## Connector names

Connector names are case-insensitive, and `connector add` stores a new name in lowercase.
On success it prints the name app code should use, for example `Use it in app code as client.connectors.eyreport_pbir.`
With `--json`, `name` is the name written to `rayfin.yml`, and `requestedName` is added when the name you passed was spelled differently.

A name that matches an existing entry in any casing refers to the same connector, so the command treats it as [re-adding an existing connector](#re-adding-an-existing-connector).
Overwriting keeps the existing spelling, for example `Inventory` from an older CLI, because the connector directory, the app wiring, and the deployed routes use it.
If several entries differ from the name only by case, an exact spelling picks one of them; otherwise the command fails and lists them.
See [Connector names](./index.md#connector-names) for how other commands and the app resolve names.

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

For `eventhouse` and `fabric-semanticmodel`, `connector add` writes the `rayfin.yml` entry and generates a complete typed `schema.ts`, but there are no GraphQL entities to discover, so no entity files are generated and no row-level security applies:

- `fabric-semanticmodel` allows `executeQuery`; `eventhouse` allows `executeQuery` and `executeCommand`. Check `rayfin connector types --json` for the current set.
- `auth.type` is `delegated` for `fabric-semanticmodel` and `application` for `eventhouse` — see [Category B](./category-b-function-bridge.md). Set it with `--auth`.
- The connector is pinned to an adapter version.
- There is no `metadata.json` entity list to generate from.

After adding, exercise the connector with [`connector invoke`](./invoke.md) rather than writing entity code.

## Wiring the app

After writing the scaffold, `connector add` (and `connector remove`) keeps the app's `src/lib/connectors.ts` in step with `rayfin.yml`, because the app reads its connectors from that file.
In a workspace, that is the file in the package that depends on `@microsoft/rayfin-connectors`.
What happens depends on who owns the file:

| File | What the CLI does | `--json` `wiring.action` |
| --- | --- | --- |
| Generated by the CLI (carries the `` @generated by `rayfin connector add` `` marker), or the empty template | Rewrites it and prints `🔌 Wired N connector(s)`, or leaves it if it is already current. | `written`, or `unchanged` |
| Hand-written, builds its maps with `import.meta.glob` over `rayfin/connectors/*/schema.ts` | Leaves it alone and prints one line: the file discovers connectors automatically, so no wiring change is needed. If a `rayfin/connectors/<name>/` directory outlives its `rayfin.yml` entry, the glob still registers that connector, so the CLI warns and lists it under `undeclared` instead. | `discovered` |
| Any other hand-written file | Leaves it alone and warns that it has manual edits, printing the maps to merge in. Until you do, the app renders nothing for the new connector. | `manual` |
| No such file | Warns that nothing was wired; the connector is registered in `rayfin.yml` only. | `absent` |
| More than one workspace package has one | Changes nothing and lists the candidate files. | `ambiguous` |

## Installing the packages

`connector add` scaffolds files but installs nothing, and the generated `schema.ts` imports packages a fresh app does not declare.
On success the command prints the exact, version-pinned install to run:

```text
📦 Install the packages this connector needs:
   npm install @microsoft/rayfin-connector-eventhouse@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha
```

Run it verbatim.
**Do not drop the version.** Connector packages ship in lockstep with the CLI, but their npm `latest` and `preview` tags lag the published release, so an unversioned install resolves to an older connector that hard-pins its own `@microsoft/rayfin-data` — leaving two Rayfin version lines in one app.

With `--json`, the same information is available under `install`:

```json
{
  "install": {
    "packages": [
      "@microsoft/rayfin-connector-eventhouse@1.35.0-alpha",
      "@microsoft/rayfin-connectors@1.35.0-alpha"
    ],
    "command": "npm install @microsoft/rayfin-connector-eventhouse@1.35.0-alpha @microsoft/rayfin-connectors@1.35.0-alpha"
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

[`connector remove`](#related-commands) removes the declaration and app wiring but preserves the entire connector directory.
To start from a clean directory, back up any files you want to keep and remove them manually.

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
