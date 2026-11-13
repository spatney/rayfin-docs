---
symbols:
  - dataService
  - createDataApi
---

# @microsoft/rayfin-data

DAB-compliant data client for GraphQL access patterns.

This package ships its own docs via the `rayfinDocs` field convention
(see [docs-package-architecture](https://github.com/microsoft/project-rayfin/tree/main/openspec/changes/docs-package-architecture)).
For the full TypeDoc reference, see the bundled docs at
`ts-sdk/@microsoft/rayfin-data/` accessible via `rayfin docs list --module ts-sdk`.

## Installation

```bash
npm install @microsoft/rayfin-data
```

## Quickstart

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { dataService } from '@microsoft/rayfin-data';

type AppSchema = {
  Note: { id: string; title: string; createdAt: Date };
};

const client = RayfinClient.create({
  baseUrl: '',
  publishableKey: 'pk-your-key',
  auth: browserSession(),
  services: { data: dataService<AppSchema>() },
});

const notes = await client.data.Note.select(['id', 'title']).execute();
```

`dataService<TSchema>()` registers the existing `createDataApi<TSchema>` result using the client's shared authenticated transport.
It preserves `/graphql` routing, typed selections, relationships, ID conveniences, and DAB mutation behavior.
Keep using `createDataApi` directly when you already own an `ApiClient`.

## GraphQL query paging

Rayfin's fluent GraphQL client sends Data API Builder compatible collection queries.
Collection queries return one page at a time.
If you do not specify a page size, Rayfin returns a default page of 100 records.

### Projected result types

GraphQL responses contain only the fields requested by the query. Rayfin reflects
that projection in the inferred TypeScript result:

```typescript
const note = await client.data.Note.select(['id', 'title']).findFirst();
// Type: Pick<Note, 'id' | 'title'> | null

note?.title; // Valid.
note?.body; // Type error: body was not selected.
```

Nested selections are projected too. For example,
`.select(['id', 'author.name'])` returns the `id` field and an `author` object
containing only `name`.

Select an array relationship with `[]`, such as `.select(['wheel[].name'])`.
This emits `wheel { items { name } }` and returns a `wheel` array with only `name`
on each element, preserving readonly and nullability in its type.
An object relationship uses an unmarked path such as `settings.name`, even when
its name looks plural.
Names do not determine nested cardinality; root entity pluralization is unchanged.
Only one relationship followed by a scalar leaf is supported.
Bare relationships, object-valued leaves, and deeper paths are not selectable.
`Date` and `Buffer` fields remain atomic scalar selections.

**Corrective compatibility migration:** Update existing data array-relationship
paths to include `[]` and replace bare relationships with explicit scalar leaves.
Object-relationship paths remain unchanged.
This does not change connector paths, whose cardinality uses registered metadata.
Malformed paths and conflicting selections fail before sending a request.
Without schema metadata, runtime validation cannot identify an untyped lone name
as a relationship; typed selections reject those bare roots.

Each `.select()` returns an independently selected builder. Calling it again
replaces the selection on that returned builder without changing a retained
earlier alias. Fluent filters, ordering, and pagination are copied into the new
builder and preserve its current projection.

Always use the builder returned by `select()`.
Ignoring that return value leaves the original builder's selection unchanged.

```typescript
const query = client.data.Note.where({ title: { contains: 'draft' } });
const selected = query.select(['id', 'title']);
const notes = await selected.execute();
```

Custom `GraphQLQueryBuilder` subclasses are constructed normally for each
selection and `findFirst()` so private fields and bound methods remain valid. Subclasses with
additional constructor arguments must override `createSelectionClone()`, and
subclasses with mutable state can override `copySelectionStateTo()`. Custom
members are hidden from row-query facades unless their keys are explicitly
declared in `readonly projectionSafeMembers`.
Only opt in members that never expose a builder or reset its result type,
including through promises, unions, or overloads.
Custom fluent methods require a projection-aware selected-builder facade.

```typescript
class LabeledQuery extends GraphQLQueryBuilder<AppSchema, 'Todo'> {
  declare readonly projectionSafeMembers: 'label';

  label(): string {
    return 'todos';
  }
}
```

Literal field tuples produce exact projected types. If the field list is a
widened or dynamically constructed array, its possible fields are optional
because the compiler cannot know which entries are present at runtime.
Alternatives inside a fixed tuple, such as
`[condition ? 'email' : 'displayName']`, are optional for the same reason.
Selected `Date` fields are typed as `Date | string` because responses can carry
wire strings. Boolean fields can similarly be `boolean | 'true' | 'false'`.
Convert these values explicitly before using date methods or boolean truthiness;
the client does not infer a field's type from an arbitrary string.

Declare `| null` on model fields or relationships that can contain database
NULL, for example `description?: string | null` or `category?: Category | null`.
The optional `?` alone models `undefined`, not a returned `null`; the client
preserves the nullability declared in the TypeScript schema.

The projection is preserved regardless of where `select()` appears in a row
query:

| Query shape                                                               | Result type                           |
| ------------------------------------------------------------------------- | ------------------------------------- |
| `.select(fields).where(...).orderBy(...).first(...).after(...).execute()` | `SelectionResult[]`                   |
| `.where(...).select(fields).execute()`                                    | `SelectionResult[]`                   |
| `.orderBy(...).select(fields).execute()`                                  | `SelectionResult[]`                   |
| `.first(...).select(fields).findFirst()`                                  | `SelectionResult \| null`             |
| `.after(...).select(fields).executePaginated()`                           | `PagedResult<SelectionResult>`        |
| No `.select()`                                                            | Primary-key-only result               |
| `.select([])`                                                             | Primary-key-only result               |
| Widened or dynamic field array                                            | Possible selected fields are optional |

Queries without `.select()` request only the entity's primary key. The
`findMany()`, `findFirst()`, and `findById()` convenience methods therefore return
primary-key-only results. Mutation results similarly contain the primary key plus
the defined primitive and `Date` fields supplied in the create or update input.
Fields from widened or optional mutation inputs remain optional in the result.
Constrained computed-key helpers are accepted for create, update, and either
upsert branch without accepting known excess keys or union-only excess keys.
Every literal union member is checked independently; a computed-key member
does not exempt a sibling containing an unknown field.
Literal inputs keep precise results.
When TypeScript widens a computed key, results guarantee only the primary key
and required create fields; other possible response fields require optional guards.
Non-Date object values without an `id` or `Id`, including `Buffer`, are omitted
from the mutation and its inferred result.
Keyed relationship inputs return a canonical lowercase `id` object, including
system entities whose input key is named `Id`.
Models without a declared primary-key property use the generated string `id`
in default reads and mutation results.

Manage one-to-many relationships through the child entity.
The mutation serializer does not expand relationship arrays into child writes;
do not pass them as relationship mutation inputs.
Arrays are currently serialized and selected, not ignored.
The result types do not guarantee an array-only field.
If a field can contain an eligible scalar or an array, its result is optional
and any possible object array elements are conservatively partial.

Mutation result types follow the same runtime contract:

| Operation                       | Result type                                  |
| ------------------------------- | -------------------------------------------- |
| `create(input)`                 | Primary key plus eligible input fields       |
| `update(where, input)`          | Primary key plus eligible input fields       |
| `delete(where)`                 | Primary key only                             |
| `upsert(where, create, update)` | Union of the create and update result shapes |

Optional or possibly undefined mutation input fields remain optional in the
result.
Fields that can contain either eligible or ignored values remain optional too.
Union inputs produce a union of the corresponding result shapes so
normal property narrowing retains each branch's returned fields. Relationship
inputs must include a concrete primary key, including when the related entity
declares its generated key as optional or appears beside scalar, `Date`, or
non-keyed object alternatives.
Each keyed branch must supply its own non-nullish `id` or `Id`; an optional
lowercase key cannot borrow a PascalCase key from another entity alternative.
Full entities, key-only references, and projected references containing the key
plus some known fields are accepted. For example, `{ id, name }` can reference a
parent even when its model also requires `createdAt`. Supplied related fields
may themselves contain projected objects or collections. Only the relationship key
is serialized and returned; other supplied parent fields are not written.
Relationship mutation values cannot be `null`; omit an optional relationship
with `undefined` instead. To clear a relationship, explicitly declare its
generated foreign-key field as nullable on the entity and update that field,
for example `{ category_id: null }`. Nullable scalar and `Date` columns still
accept `null`.
The runtime rejects a relationship object's null or undefined key before sending
the mutation, including when an input alias has erased the key's presence from
its static type. An actually present lowercase `id` takes priority over `Id`;
an invalid lowercase key never falls back to a valid `Id`. This validation applies
only to the referenced object's key, not its ignored projected fields.
Genuinely non-keyed object alternatives remain ignored by the serializer and
do not guarantee a returned relationship.
Unknown mutation fields
are rejected at compile time, including explicitly named fields beside a
constrained computed key. Named relationship values in those objects still
require concrete keys; widening a computed key does not exempt them.

#### Complete API result contract

| API                               | Result typing                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `select(fields)`                  | Starts or replaces an exact projection; a widened field array produces optional possible fields |
| `where(filter)`                   | Preserves the active projection; primary-key-only when no selection exists                      |
| `orderBy(order)`                  | Preserves the active projection; primary-key-only when no selection exists                      |
| `first(count)`                    | Preserves the active projection; primary-key-only when no selection exists                      |
| `after(cursor)`                   | Preserves the active projection; primary-key-only when no selection exists                      |
| `execute()`                       | `ActiveResult[]`                                                                                |
| `executePaginated()`              | `PagedResult<ActiveResult>`                                                                     |
| Fluent `findFirst()`              | `ActiveResult \| null`                                                                          |
| Entity `findMany(filter?)`        | `PrimaryKeyOnly<Entity>[]`                                                                      |
| Entity `findFirst(filter?)`       | `PrimaryKeyOnly<Entity> \| null`                                                                |
| Entity `findById(id)`             | `PrimaryKeyOnly<Entity> \| null`                                                                |
| `create(input)`                   | Primary key plus eligible input fields                                                          |
| `update(where, input)`            | Primary key plus eligible input fields                                                          |
| `delete(where)`                   | `PrimaryKeyOnly<Entity>`                                                                        |
| `upsert(where, create, update)`   | Union of create and update result shapes                                                        |
| `groupBy(fields).aggregate(spec)` | Existing grouped aggregation result; cannot be combined with row selection                      |
| `aggregate(spec)`                 | Existing ungrouped aggregation result; cannot be combined with row selection                    |

Use `.first(n)` to request a specific page size.
Use `.executePaginated()` when the query can return more than one page because it returns the `items`, `hasNextPage`, and `endCursor` fields from the DAB response.

```typescript
const page = await client.data.Note.select(['id', 'title', 'createdAt'])
  .orderBy({ createdAt: 'desc' })
  .first(25)
  .executePaginated();

const items = page.items;
const hasMore = page.hasNextPage;
const nextCursor = page.endCursor;
```

Pass the previous page's `endCursor` to `.after(cursor)` to fetch the next page.
Keep the selected fields, filters, and sort order stable across pages so the cursor advances through the same ordered result set.

```typescript
const nextPage = await client.data.Note.select(['id', 'title', 'createdAt'])
  .orderBy({ createdAt: 'desc' })
  .first(25)
  .after(nextCursor)
  .executePaginated();
```

`.execute()` returns only the current DAB page and unwraps the `items` array.
Use `.execute()` only for queries you know are bounded under one page.
For lists that can grow, loop with `.executePaginated()` until `hasNextPage` is `false`.

Rayfin also enforces a maximum page size of 100,000 records.
Use `.first(-1)` to request the maximum for a single page, but prefer cursor pagination for large result sets.

## Text field nullability

Required `@text()` fields return an empty string when the stored value is empty.
Optional `@text({ optional: true })` fields preserve `null` so callers can distinguish an intentionally missing value from empty text.
