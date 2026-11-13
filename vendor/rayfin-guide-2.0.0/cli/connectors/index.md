---
sidebar_position: 6
---

# Connectors

Connectors let a Rayfin app read from — and, for some types, write to — Microsoft Fabric data sources: warehouses, SQL databases, Lakehouse SQL analytics endpoints, semantic models, and KQL databases.

The `connector` command group is always available.

**Lakehouse scope:** `fabric-sqlanalytics` connects only to a Lakehouse's SQL analytics endpoint.
It can read SQL-visible tables and views, but it cannot directly open files from the Lakehouse `Files` area, such as PDFs or images.
This connector is read-only; the Warehouse and SQL Database connectors also support write operations.

> **`eventhouse` authoring is held in this release.** `connector types` and `connector search` omit it, and `connector add --type eventhouse` refuses it. A project that **already declares** an `eventhouse` connector is unaffected: it still validates, deploys through `rayfin up`, and answers `connector invoke`. Eventhouse material in these docs describes that preserved runtime contract and the authoring path for when it ships.
>
> **`fabric-dataagent` authoring is held in this release**, and the connector remains experimental, not generally available.
> `connector types` and `connector search` omit it, and `connector add --type fabric-dataagent` refuses before writing files.
> Existing configurations remain valid and retain their deployment and invocation paths; live use still requires the Data Agent backend adapter.

Each command has its own reference page:

- [`connector search`](./search.md) — discover Fabric sources the signed-in identity can add.
- [`connector add`](./add.md) — declare a connector in `rayfin.yml` and scaffold its files.
- [`connector inspect`](./inspect.md) — list a source's entity names, or run a single read-only sample query against one.
- [`connector invoke`](./invoke.md) — run one named operation against a configured connector.

Each category has its own contract page — read the one that matches your connector type, not both:

- [Category A — GraphQL entity connectors](./category-a-entities.md) — now **package-owned**; the full reference (entity generation, `@role` policies, the aggregate schema, and the per-dialect read/write matrix) ships in `@microsoft/rayfin-connector-fabric-graphql` (`rayfin docs search` / `search_docs`).
- [Category B — function-bridge connectors](./category-b-function-bridge.md) — the `fabric-semanticmodel`, experimental `fabric-dataagent` and experimental `eventhouse` contract, including the Eventhouse cluster routing baked into the generated `schema.ts`.
- [Eventhouse usage guide](./eventhouse.md) — the experimental `eventhouse` supplement, now **package-owned**; when to reach for the type, its streaming model, shaping KQL, safe query construction, and reading results all ship in `@microsoft/rayfin-connector-eventhouse` (`rayfin docs search` / `search_docs`).

A typical loop is search → add → inspect (Category A) or search → add → invoke (Category B).

## Two categories of connector

The commands available to a connector, and the code you write against it, depend on its category.

|                                       | Category A — GraphQL entity connectors                                                                                                                                           | Category B — function-bridge connectors                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Types**                             | `fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`                                                                                                                  | `fabric-semanticmodel`; `fabric-dataagent` (**experimental**); `eventhouse` (**experimental**) |
| **App surface**                       | Generated entity files with typed CRUD through the data client                                                                                                                   | Named operations carrying raw queries                                                          |
| **Operations**                        | `read` only for `fabric-sqlanalytics` (Lakehouse SQL endpoints are read-only); `read`, `create`, `update`, `delete` for `fabric-warehouse` and `fabric-sqldatabase` (narrowable) | `executeQuery`; experimental `fabric-dataagent` uses named task operations instead             |
| **Auth**                              | `delegated` or configured per project                                                                                                                                            | `application` for `eventhouse`; `delegated` for the others                                     |
| **Entity files and `@role` policies** | Yes                                                                                                                                                                              | No                                                                                             |
| **`metadata.json` entities**          | Yes                                                                                                                                                                              | No                                                                                             |
| **`connector inspect`**               | Supported                                                                                                                                                                        | `fabric-semanticmodel` only — experimental `eventhouse` is not supported                       |
| **`connector invoke`**                | Rarely needed                                                                                                                                                                    | The main way to exercise the connector                                                         |

Category B connectors are pinned to an adapter version and expose no GraphQL entities, so there is nothing to generate and no row-level security to author.

## Where connector state lives

- `rayfin/rayfin.yml` — the `connectors:` block: each connector's `name`, `type`, `config` (workspace and item IDs), `auth`, and `operations`.
- `rayfin/connectors/<name>/metadata.json` — discovered schema for Category A connectors; the source for generating entity files.
- `rayfin/connectors/<name>/schema.ts` — placeholder scaffold written by `connector add`.

`npx rayfin connector list` prints the configured connectors.
`npx rayfin connector remove <name>` removes the `rayfin.yml` entry and updates app wiring, but preserves the entire `rayfin/connectors/<name>/` directory, including user-authored schemas and entity files.
Only legacy temporary artifacts under `rayfin/.temp/sources/<name>/` are deleted.
Removal requires confirmation; pass `--yes` in non-interactive environments.
JSON output reports `directoryDeleted: false`.
Preserved files may still be included in TypeScript builds, including during `rayfin up`, even though the connector is no longer declared.
Keep their dependencies until you have backed up and removed or excluded the unused files.
The removal command prints this guidance and includes it in the JSON `recovery` field.

## Connector names

A connector name is a case-insensitive identifier.
The spelling in `rayfin.yml` is canonical: it names the `rayfin/connectors/<name>/` directory, the keys in `src/lib/connectors.ts`, and the backend routes `rayfin up` deploys.
`connector add` stores new names in lowercase, so `--name EYReport_PBIR` declares `eyreport_pbir`.
Entries written by older CLI versions keep their mixed-case spelling.

`connector remove`, `connector invoke`, `connector inspect --name`, and `up connector apply --name` match the name you pass case-insensitively and then use the `rayfin.yml` spelling.
In app code, `client.connectors.<name>` resolves the same way at runtime: an exact key wins, otherwise the one key that differs only by case, and every spelling returns the same client.
Typed access through `AppConnectorsSchema` still needs the exact key.

Connector validation, run by `rayfin up` and `rayfin dev`, flags two entries whose names differ only by case; rename or remove one of them.
Until you do, `connector remove`, `connector invoke`, `connector inspect --name`, and `up connector apply --name` fail with the candidate names when no entry matches exactly, and app code fails with `AMBIGUOUS_CONNECTOR`.

## Deploying connectors

The app's managed database belongs to its data service, not an external connector.
Backend builds that enforce this rule reject existing Category A connectors pointing at that database when settings or schemas are applied, even when the data service is disabled.
Before redeploying an affected app, run `npx rayfin connector remove <name>` for each conflicting connector and update application code to use the data service.
Removing the connector preserves its local files; follow the build guidance above before uninstalling dependencies.

```bash
npx rayfin up                                     # deploy connectors to the cloud
npx rayfin up connector apply [--name <name>]     # re-apply DAB config only
```

Most connector commands work before deployment. The exception is [`connector invoke`](./invoke.md) for every type except `fabric-semanticmodel`, which posts to the deployed item and therefore requires a prior `rayfin up`.
