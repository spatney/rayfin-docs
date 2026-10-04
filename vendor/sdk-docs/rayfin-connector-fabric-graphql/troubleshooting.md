---
symbols: []
---

# Category A — troubleshooting

Anti-patterns and a symptom to cause to fix matrix for `fabric-sqlanalytics`, `fabric-warehouse`, and `fabric-sqldatabase`. For the authoring rules these reference, see [Entities](./entities.md); for the aggregate schema see [the overview](./index.md).

## Anti-patterns

- Never leave `schema.ts` as bare re-exports — the client import of `<Name>Schema` and `connectorConfig` fails.
- Populate `connectorConfig.entities` with the generated entity **classes** (e.g. `entities: { Order, Customer }`), never omit it. Omitting it makes every no-selection `findMany` / `findFirst` / `findByKey` throw `SELECTION_REQUIRED`.
- Never rely on `entities` to cover a query chain. `.where()` / `.orderBy()` / `.first()` do not inherit the default selection — always pair them with `.select([...])`.
- In subset mode, list in `TSchema` only entities you actually generated.
- Keep `connectorConfig.operations` identical to the YAML `operations:`, and each entity `@role(...)` action a subset of that pair. Narrow YAML first; never widen a decorator just to match the connector.
- Policies use the typed `claims` / `item` DSL — never raw SQL or DAB-policy strings.
- Never double-pluralize an entity name. Names are global across connectors — disambiguate duplicates, never blanket-prefix.
- `metadata.json` is the only source of truth for keys and relationships. Never synthesize a PK or infer a relationship from column names, sampled values, or naming — absent metadata means keyless and relationship-free.
- When the user asks for one entity, read `metadata.json` and filter — do not regenerate every table.
- Never hand-edit `metadata.json` or `dab-config.json` — both are regenerated.

## Symptom → cause → fix

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `rayfin up connector apply` fails on a role action | Entity `@role(...)` includes an action not in the YAML `operations:` | Narrow the decorator to match YAML. |
| `rayfin up connector apply` fails with a duplicate GraphQL type | Two connectors generated an entity with the same name — names are global | Disambiguate by prefixing the source database name; update the class, file, `@entity`, `TSchema` key, and access path together, then re-apply. |
| `Reserved GraphQL type names detected in connector entities` | An entity is named after a built-in scalar or an operation root type (`Date`, `Int`, `Query`, …), which the generated schema already defines | Rename the class (`Date` → `DateRecord`), keep `Source({ table: '...' })` on the original table, update the `@entity`, `TSchema` key, re-export, and access path, then re-apply. |
| `rayfin connector add` writes the YAML entry but no entity files | Expected — the CLI never emits entity files | Generate them from `metadata.json` per the contract. If `metadata.json` is also missing, discovery failed. |
| `Property '<name>' does not exist on connectors` | Connector key in `AppConnectorsSchema` does not match the `connectors` option | Use the `rayfin.yml` `name` in all three places. |
| A CRUD method is missing from autocomplete | Expected: `<Name>Schema` narrows methods to `operations` | Widen via `rayfin connector add --operations`, then re-import. |
| Import of `ConnectorsRayfinClient` fails to resolve | Imported from the removed or misspelled experimental subpath | Import from the stable `@microsoft/rayfin-client` entry. |
| `Cannot find module '@microsoft/rayfin-connector-fabric-graphql'` | Connector packages never installed — `connector add` does not add them | Run the pinned `npm install` that `connector add` printed. |
| A query chain throws `SELECTION_REQUIRED` | The chain (`.where()` / `.orderBy()` / `.first()` → `.execute()`) has no `.select()`. `connectorConfig.entities` does not supply a default here — only `findMany` / `findFirst` / `findByKey` read it | Add `.select([...])` to the chain, or drop to `findMany(filter)` if you need neither ordering nor a row limit. |
| `findMany` / `findFirst` / `findByKey` throws `SELECTION_REQUIRED` | `connectorConfig.entities` is missing, so there is no default column list | Add the entity class to `connectorConfig.entities`, or pass an explicit selection to the call. |

## Error codes

Every runtime failure on the connector path is a `ConnectorsError` carrying one of these codes.

| Code | Thrown when | Fix |
| --- | --- | --- |
| `SELECTION_REQUIRED` | A chain reached `.execute()` / `.executePaginated()` with no `.select()`, or a no-selection `findMany` / `findFirst` / `findByKey` ran while `connectorConfig.entities` was unpopulated | Add `.select([...])`, or register the entity class in `connectorConfig.entities`. |
| `ENTITIES_REQUIRED_FOR_RELATIONSHIP_SELECT` | A dotted path (`category.name`) was selected but `connectorConfig.entities` is unpopulated, so relationship cardinality is unknown | Register every entity the path traverses, not just the root. |
| `INVALID_RELATIONSHIP_SELECTION` | A segment of a dotted path is not a `@one` / `@many` field on that entity | Fix the path, or select the column directly if it is a plain scalar. |
| `INVALID_COLUMN_NAME` | A selection or mutation input used a name that is not a legal GraphQL name | Use the entity **property** name, never the raw SQL column — the `column:` option maps between them. |
| `EMPTY_MUTATION_SELECTION` | A mutation had no columns left to return | Pass at least one input column, or register the entity in `connectorConfig.entities` so server-generated columns are returned. |
| `MUTATION_NO_RESULT` | The server ran the mutation but returned no data | Usually a `@role` policy filtering the row out, or a key that matches nothing — verify both. |
| `OPERATION_NOT_ALLOWED` | A CRUD method was reached that is outside the connector's `operations:` (the runtime gate behind the compile-time narrowing) | Widen `operations:` in `rayfin.yml` **and** `connectorConfig`, re-apply, then re-import. |
| `UNKNOWN_CONNECTOR` | A connector was accessed that was never passed in the client's `connectors` option | Add it to `connectors: { <name>: connectorConfig }` — the key must match the `rayfin.yml` `name`. |
