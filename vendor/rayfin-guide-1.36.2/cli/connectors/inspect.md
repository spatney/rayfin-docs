---
sidebar_position: 3
---

# connector inspect

```bash
npx rayfin connector inspect (--name <name> | <direct-selector-flags>) [--entity <name> | --query <path>] [--rows <n>] [--verbose] [--json]
```

`connector inspect` takes no positional arguments — every selector and query mode is a flag.

`connector inspect` explores a connector's underlying source in read-only mode, before you have written any app code. Run it with just a selector to **list the entity/table names** the source exposes; add `--entity` to sample one of them, or `--query` to run a `.sql`/`.dax` file of your own. Use it to check a table's real data and shape ahead of entity generation, or to debug a row-level-security or query issue on an already-wired connector. It is a development aid — never use it to power app functionality.

Supported types: the three Category A SQL types (`fabric-sqlanalytics`, `fabric-warehouse`, `fabric-sqldatabase`) and `fabric-semanticmodel` (DAX). `kusto` is **not** supported today — the command errors with `Unsupported connector type: kusto`.

## Pick exactly one selector, and at most one query mode

Two independent choices. The **selector** is a mutually exclusive pair — passing zero or both fails validation before any network call. The **query mode** has three options, and omitting it is a mode of its own rather than an error; only passing `--entity` and `--query` together fails.

| Selector — which connector or item to query | Meaning                                                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--name <name>`                             | A connector already declared in `rayfin.yml`.                                                                                                                                     |
| Direct mode                                 | `--workspace-id`/`--workspace <name>` plus `--item-id`/`--item <name>` plus `--type <type>`, or `--url <portal-url>` for a semantic model (auto-extracts workspace and item IDs). |

| Query mode                     | What it runs                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| _omit both_ — entity listing   | Lists the entity/table names the source exposes, so you have something to pass to `--entity`. This is the default. |
| `--entity <name>` — structured | Builds `SELECT TOP (n) * FROM <entity>` (SQL) or `EVALUATE TOPN(n, '<entity>')` (DAX) for you.                     |
| `--query <path>` — raw         | Runs the literal `.sql` or `.dax` file verbatim, still capped and validated.                                       |

All six combinations of `{--name, direct} × {listing, --entity, --query}` are valid.

`--workspace` and `--item` accept display names and are resolved to IDs the same way [`connector add`](./add.md) fuzzy matching works; `--workspace-id` and `--item-id` take literal IDs directly.

## Entity listing

Omitting both `--entity` and `--query` lists the entity names available on the source. This is the starting point when you don't know the names yet — the output is what you feed back into `--entity`, and the command prints a ready-to-run `--entity` suggestion carrying the same selector flags you just used.

- **SQL types** — reads `INFORMATION_SCHEMA.TABLES`, returning `TABLE_SCHEMA` and `TABLE_NAME`.
- **`fabric-semanticmodel`** — reads `INFO.TABLES()`, returning table names.

Listing honours `--rows` and `--json` like any other mode, and the `--json` envelope reports `queryMode: "entities"`.

## Entity resolution

Applies to `--entity` mode only.

- **`--name` plus `--entity` with an unqualified name (no `.`)** — first checked against the connector's local `rayfin/connectors/<name>/metadata.json`, with no network call. Zero matches falls through to live resolution; exactly one match auto-qualifies to `schema.table`; more than one match fails immediately asking you to disambiguate with a schema-qualified name. It does **not** fall through to live resolution in the ambiguous case.
- **Any other combination** — direct mode, or `--query` mode — never consults `metadata.json`. For SQL types, an unqualified `--entity` is resolved live via `SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE LOWER(TABLE_NAME) = LOWER('<entity>')`: zero matches passes the name through unqualified, one match auto-qualifies, more than one match throws asking you to disambiguate with `--entity <schema>.<table>`.
- A schema-qualified `--entity <schema>.<table>` skips resolution entirely, in both cases.

## Validation

Applies to `--entity` and `--query` modes.

- **SQL** — must start with `SELECT` or `WITH`; an embedded `;` is rejected while a trailing `;` is allowed; rejects `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `EXEC`/`EXECUTE`, and `INTO` anywhere outside a string literal.
- **SQL result contract** — the query must produce one result set. If Tedious emits a second result set, inspection rejects the query instead of combining rows with a different column contract.
- **DAX** — must start with `EVALUATE`.
- `--query <path>` must resolve to a `.sql` or `.dax` file inside the project root; paths outside it are rejected. The project root is the directory containing `rayfin/rayfin.yml` when one is found. Direct mode (no `--name`) falls back to the current working directory if no `rayfin.yml` exists, so `--query` never requires a Rayfin project.
- `--rows <n>` caps the sample size — maximum 100. The default is mode-specific: entity listing (neither `--entity` nor `--query`) defaults to **100**, while `--entity` and `--query` sampling default to **10**. The result reports `truncated: true` when the source had more rows than the cap; inspect fetches one row beyond the cap to detect that, then discards it.

## SQL column types and values

SQL inspection reads column types from Tedious result metadata, including when a query returns zero rows.
It never guesses a column type from row values.
Plain output lists each column as `name (type)` before populated or empty results.
If the contract exceeds the terminal width, it folds between column entries.

The `columns[].type` field in JSON uses this normalized vocabulary:

| Normalized type    | Tedious metadata types                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `integer`          | `TinyInt`, `SmallInt`, `Int`, `BigInt`, `IntN`                          |
| `decimal`          | `Decimal`, `Numeric`, money types, and their nullable forms              |
| `floating-point`   | `Real`, `Float`, `FloatN`                                                |
| `text`             | Character and Unicode text types, plus `Xml`                             |
| `boolean`          | `Bit`, `BitN`                                                            |
| `date`             | `Date`                                                                   |
| `time`             | `Time`                                                                   |
| `datetime`         | `SmallDateTime`, `DateTime`, `DateTimeN`, `DateTime2`, `DateTimeOffset` |
| `uniqueidentifier` | `UniqueIdentifier`                                                       |
| `binary`           | `Binary`, `VarBinary`, `Image`                                           |
| `unknown`          | `Null`, `Variant`, `UDT`, `TVP`, and unrecognized or custom types       |

Plain output renders SQL `date` values as `YYYY-MM-DD`, so the calendar value does not shift with the local time zone.
SQL `time` values render as the UTC time portion `HH:mm:ss.sss`, without Tedious' internal 1970 date anchor.
SQL `datetime` and `datetime2` are timezone-naive values that Tedious represents using a JavaScript `Date`; plain and JSON output therefore use an ISO value with `Z` by driver convention.
SQL `datetimeoffset` is also returned as a JavaScript `Date`, so its original offset is not preserved.
SQL `bigint` row values are strings, while decimal and numeric row values are JavaScript numbers and can carry JavaScript precision limitations.
Binary and buffer-backed custom values render as terminal-safe `0x` hexadecimal in plain output and use the existing column-width truncation marker when needed.
JSON row serialization is unchanged: JavaScript `Date` values remain ISO strings, while `columns[].type` now reports the metadata-derived normalized type instead of `unknown`.
Queries that produce a second SQL result set are rejected when the driver emits its second column contract, including newline-separated batches without semicolons.

## Examples

```bash
# --name selector, no query mode: list the entity names on the source
npx rayfin connector inspect --name inventory

# --name selector + structured entity mode
npx rayfin connector inspect --name inventory --entity Order

# --name selector + raw query file
npx rayfin connector inspect --name inventory --query rayfin/queries/order.sql

# Direct selector, no query mode: list the entity names on the source
npx rayfin connector inspect --workspace-id <ws-id> --item-id <item-id> --type fabric-warehouse

# Direct selector (literal IDs) + structured entity mode
npx rayfin connector inspect --workspace-id <ws-id> --item-id <item-id> --type fabric-warehouse --entity Order

# Direct selector (fuzzy display names) + raw query file
npx rayfin connector inspect --workspace "Sales Analytics" --item "Inventory Warehouse" --type fabric-warehouse --query rayfin/queries/order.sql

# Semantic model (DAX), resolved from a Fabric portal URL
npx rayfin connector inspect --url <fabric-portal-semantic-model-url> --query rayfin/queries/model.dax
```

Combine `--workspace-id`, `--item-id`, and `--type` with entity listing, `--entity`, or `--query` freely — none of the six combinations require `--name` or a `rayfin.yml` entry to exist.

## Errors

SQL errors are categorized before being shown:

| Condition                                                      | Surfaced as                                                                            |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| SQL Server error `229`, `230`, `262`, `297`, `300`             | "Permission denied", with a permissions recovery hint.                                 |
| SQL Server error `18456`, `4060`, or `ELOGIN`                  | "Authentication failed", with a `rayfin login` recovery hint.                          |
| Anything else, including invalid object name / table not found | The underlying message, with a generic "verify the entity/table name and access" hint. |

Semantic model HTTP errors map `401` to re-login, `403` to permissions, and everything else to the generic hint.
