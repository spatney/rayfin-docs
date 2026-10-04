---
sidebar_position: 6
---

# Connectors

Connectors let a Rayfin app read from — and, for some types, write to — Microsoft Fabric data sources: warehouses, SQL databases, Lakehouse SQL analytics endpoints, semantic models, and KQL databases.

The `connector` command group is always available.

**Lakehouse scope:** `fabric-sqlanalytics` connects only to a Lakehouse's SQL analytics endpoint.
It can read SQL-visible tables and views, but it cannot directly open files from the Lakehouse `Files` area, such as PDFs or images.
This connector is read-only; the Warehouse and SQL Database connectors also support write operations.

> **`kusto` authoring is held in this release.** `connector types` and `connector search` omit it, and `connector add --type kusto` refuses it. A project that **already declares** a Kusto connector is unaffected: it still validates, deploys through `rayfin up`, and answers `connector invoke`. Kusto material in these docs describes that preserved runtime contract and the authoring path for when it ships.

Each command has its own reference page:

- [`connector search`](./search.md) — discover Fabric sources the signed-in identity can add.
- [`connector add`](./add.md) — declare a connector in `rayfin.yml` and scaffold its files.
- [`connector inspect`](./inspect.md) — list a source's entity names, or run a single read-only sample query against one.
- [`connector invoke`](./invoke.md) — run one named operation against a configured connector.

Each category has its own contract page — read the one that matches your connector type, not both:

- [Category A — GraphQL entity connectors](./category-a-entities.md) — now **package-owned**; the full reference (entity generation, `@role` policies, the aggregate schema, and the per-dialect read/write matrix) ships in `@microsoft/rayfin-connector-fabric-graphql` (`rayfin docs search` / `search_docs`).
- [Category B — function-bridge connectors](./category-b-function-bridge.md) — the `fabric-semanticmodel` and experimental `kusto` contract, including the Kusto cluster routing baked into the generated `schema.ts`.
- [Eventhouse (`kusto`) usage guide](./eventhouse.md) — the experimental `kusto` supplement, now **package-owned**; when to reach for the type, its streaming model, shaping KQL, safe query construction, and reading results all ship in `@microsoft/rayfin-connector-kusto` (`rayfin docs search` / `search_docs`).

A typical loop is search → add → inspect (Category A) or search → add → invoke (Category B).

## Two categories of connector

The commands available to a connector, and the code you write against it, depend on its category.

|                                       | Category A — GraphQL entity connectors                                                                                                                                           | Category B — function-bridge connectors                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Types**                             | `fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`                                                                                                                  | `fabric-semanticmodel`; `kusto` (**experimental**)      |
| **App surface**                       | Generated entity files with typed CRUD through the data client                                                                                                                   | Named operations carrying raw queries                  |
| **Operations**                        | `read` only for `fabric-sqlanalytics` (Lakehouse SQL endpoints are read-only); `read`, `create`, `update`, `delete` for `fabric-warehouse` and `fabric-sqldatabase` (narrowable) | `executeQuery` only                                    |
| **Auth**                              | `delegated` or configured per project                                                                                                                                            | Must be `delegated`                                    |
| **Entity files and `@role` policies** | Yes                                                                                                                                                                              | No                                                     |
| **`metadata.json` entities**          | Yes                                                                                                                                                                              | No                                                     |
| **`connector inspect`**               | Supported                                                                                                                                                                        | `fabric-semanticmodel` only — experimental `kusto` is not supported |
| **`connector invoke`**                | Rarely needed                                                                                                                                                                    | The main way to exercise the connector                 |

Category B connectors are pinned to an adapter version and expose no GraphQL entities, so there is nothing to generate and no row-level security to author.

## Where connector state lives

- `rayfin/rayfin.yml` — the `connectors:` block: each connector's `name`, `type`, `config` (workspace and item IDs), `auth`, and `operations`.
- `rayfin/connectors/<name>/metadata.json` — discovered schema for Category A connectors; the source for generating entity files.
- `rayfin/connectors/<name>/schema.ts` — placeholder scaffold written by `connector add`.

`npx rayfin connector list` prints the configured connectors; `npx rayfin connector remove <name>` deletes both the `rayfin.yml` entry and the `rayfin/connectors/<name>/` directory.

## Deploying connectors

```bash
npx rayfin up                                     # deploy connectors to the cloud
npx rayfin up connector apply [--name <name>]     # re-apply DAB config only
```

Most connector commands work before deployment. The exception is [`connector invoke`](./invoke.md) for every type except `fabric-semanticmodel`, which posts to the deployed item and therefore requires a prior `rayfin up`.
