---
symbols: []
---

# Category A — querying

Reading entities: the query chain, by-key lookups, and related columns. For roll-ups (`groupBy` / `aggregate`) see the `@microsoft/rayfin-data` package docs (`aggregations.md`); for writes see [Mutations](./mutations.md); for authoring see [Entities](./entities.md).

Each entity is reached via `client.connectors.<name>.<Entity>`. The surface depends on `operations:` (which verbs) and the dialect (what writes return). **Reads are identical on Lakehouse, Warehouse, and SQL Database.**

## Which reads need an explicit `select`

There are two read surfaces, and they treat selection differently. Getting this wrong is the most common Category A runtime error.

| Surface | Entry points | Selection | Ordering / row limit |
| --- | --- | --- | --- |
| Convenience methods | `findMany`, `findFirst`, `findByKey` | Optional — falls back to the default columns from `connectorConfig.entities` | Not available |
| Query chain | `.select()`, `.where()`, `.orderBy()`, `.first()` → `.execute()` / `.executePaginated()` | **Mandatory `.select([...])`** | `.orderBy()` / `.first(n)` / `.after(cursor)` |

The default selection from `connectorConfig.entities` **never** reaches the query chain. A chain that reaches `.execute()` with no `.select()` throws `SELECTION_REQUIRED` even when `entities` is fully populated:

```ts
// ❌ throws SELECTION_REQUIRED — .first() does not inherit the default columns.
await client.connectors.inventory.Order.first(20).execute();

// ✅ chain with an explicit selection.
await client.connectors.inventory.Order
  .select(['orderId', 'customerEmail', 'total'])
  .first(20)
  .execute();

// ✅ no selection needed — findMany uses the default columns.
await client.connectors.inventory.Order.findMany();
```

Because `findMany` accepts only a selection and a filter, any read that needs `orderBy` or a row cap must use the chain — and therefore must name its columns.

## Reads

```ts
// Query chain: select -> where -> orderBy -> first -> execute.
// .select() is required on every chain.
const orders = await client.connectors.inventory.Order
  .select(['orderId', 'customerEmail', 'total'])
  .where({ total: { gt: 100 } })
  .orderBy({ total: 'desc' })
  .first(20)
  .execute();

// findMany / findFirst: `(fields?, filter?)` or `(filter?)`.
// An array first argument is the selection; anything else is the filter.
const all = await client.connectors.inventory.Order.findMany();
const big = await client.connectors.inventory.Order.findMany({ total: { gt: 100 } });
const cols = await client.connectors.inventory.Order.findMany(
  ['orderId', 'total'],
  { total: { gt: 100 } },
);
const one = await client.connectors.inventory.Order.findFirst({ orderId: { eq: 'o-1' } });

// By-key: full key object; select is optional.
// Omit select -> full row; pass a scalar-only select -> just those columns.
const order = await client.connectors.inventory.Order.findByKey({ orderId: 'o-1' });

const orderCols = await client.connectors.inventory.Order.findByKey(
  { orderId: 'o-1' },
  ['orderId', 'customerEmail', 'total'],
);

// Composite key: every part required.
const lineItem = await client.connectors.sales.OrderItem.findByKey({
  orderId: 'o-1',
  productId: 'p-9',
});
```

`.execute()` and `findMany` return a plain array of rows; `findFirst` and `findByKey` return `Row | null`. For a cursor envelope, end the chain with `.executePaginated()` instead — see [Paging](#paging).

`findByKey` takes the full primary key (required) and an **optional** scalar-only
`select`. With no `select` it returns the full `Row | null`; with one it returns
`Pick<Row, selected> | null`. It is scalar-only — read relationships through the
query chain. Omitting a composite-key part is a compile error.

Keyless entities (`primaryKey: []`, common on Lakehouse and Warehouse) drop `findByKey`, `update`, and `delete` at compile time — reads go through the chain, `findMany`, and `findFirst`, and `create` is still available if `operations:` allows it.

## Filters

`.where(...)` and the filter argument of `findMany` / `findFirst` take the same DAB filter object: one entry per column, each an operator map. The operators available depend on the column kind.

| Column kind | Operators |
| --- | --- |
| string (`@text`, `@uuid`, `@email`) | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` (lexicographic), `contains`, `notContains`, `startsWith`, `endsWith`, `isNull`, `in` |
| number (`@int`, `@decimal`) | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `isNull`, `in` |
| `@date` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `isNull`, `in` |
| `@boolean` | `eq`, `neq`, `isNull`, `in` |

Sibling entries are ANDed. Combine alternatives with `and` / `or` — lowercase per the DAB spec, each taking an **array** of filter objects. There is no `not`.

```ts
await client.connectors.inventory.Order
  .select(['orderId', 'status', 'total'])
  .where({
    status: { in: ['open', 'pending'] },
    shippedUtc: { isNull: true },
    or: [{ total: { gte: 1000 } }, { customerEmail: { endsWith: '@contoso.com' } }],
  })
  .execute();
```

`isNull: true` matches nulls, `isNull: false` matches non-nulls.

## Paging

`.first(n)` returns a single page. `n` is bounded by DAB's maximum page size (100,000); `-1` requests an unbounded page, which DAB still caps at that maximum. `.execute()` and `findMany` hand back that one page as a plain array, so a table larger than the page size needs cursors.

Finish the chain with `.executePaginated()` and feed `endCursor` into `.after()` on the next chain:

```ts
const page = await client.connectors.inventory.Order
  .select(['orderId', 'total'])
  .orderBy({ orderId: 'asc' })
  .first(500)
  .executePaginated();

if (page.hasNextPage && page.endCursor) {
  const next = await client.connectors.inventory.Order
    .select(['orderId', 'total'])
    .orderBy({ orderId: 'asc' })
    .first(500)
    .after(page.endCursor)
    .executePaginated();
}
```

`executePaginated()` returns `PagedResult<Row>` — `{ items, hasNextPage, endCursor?, totalCount? }`. Pagination is forward-only; DAB has no `last` / `before`.

`.after()` and `.executePaginated()` live on the builder, not on the entity client, so the chain still has to start with `.select([...])` / `.where(...)` — and `.executePaginated()` requires the same explicit selection as `.execute()`.

## Related columns

`select` pulls columns from a `@one` or `@many` navigation field as a **dotted path**. Name the leaf column (`category.name`), never the bare relationship (`category`) — that is a compile error. Paths nest to any depth.

Segment validation is typed only as far as `TSchema` describes the hop, and cardinality is resolved at runtime from `connectorConfig.entities`. A path that gets past the compiler still throws: `INVALID_RELATIONSHIP_SELECTION` when a segment is not a `@one` / `@many` field, and `ENTITIES_REQUIRED_FOR_RELATIONSHIP_SELECT` when the entity classes were never registered. Register every entity a path traverses, not just the root.

```ts
const products = await client.connectors.inventory.Product
  .select(['name', 'category.name', 'orderItems.quantity'])
  .where({ stock: { gt: 0 } })
  .execute();

products[0].category.name;          // @one  — related row inline
products[0].orderItems[0].quantity; // @many — related rows unwrapped inline

// Nest across entities to arbitrary depth.
await client.connectors.inventory.Product
  .select(['name', 'orderItems.order.customerEmail'])
  .execute();
```

Self-referencing FKs generate an entity and DAB relationship, but the client cannot query across one — do not select a dotted path over a self-relationship.
