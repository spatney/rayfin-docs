---
symbols: [aggregate, groupBy, sum, avg, min, max, count, having, distinct]
---

# GraphQL aggregation

Rayfin's fluent GraphQL client supports type-safe aggregation over a collection.
Use `.aggregate()` on its own for grand totals, or pair it with `.groupBy()` for per-group results.
Every aggregation runs through Data API Builder (DAB), so the query stays DAB-compliant.

The aggregation specification is keyed by Builder-chosen aliases.
Each alias maps to a single operation object: `{ sum | avg | min | max | count }`.
The operation value is either a field-name shorthand (`'points'`) or an options object (`{ field, having?, distinct? }`).

All five operations accept only numeric fields, because DAB generates each `field` argument as the entity's numeric-aggregate enum.
Non-numeric fields (such as a `uuid` id or a `text` column) are rejected by the server.

## Result shape

Every aggregation query returns an array of rows.
Each row has a `fields` object holding the `groupBy` values and an `aggregations` object keyed by your aliases.

A grand-total query (no `groupBy`) returns exactly one row whose `fields` is an empty object.
A grouped query returns one row per group.

`count` results are non-nullable `number`.
`sum`, `avg`, `min`, and `max` results are `number | null`, because SQL returns `NULL` over empty or all-null groups.

## Grand-total aggregation

Call `.aggregate()` without `.groupBy()` to aggregate across all matching rows.

```typescript
const rows = await client.data.Todo.aggregate({
  total: { sum: "points" },
}).execute();

const total = rows[0].aggregations.total; // number | null
```

Combine several operations in one call by giving each its own alias.

```typescript
const rows = await client.data.Todo.aggregate({
  average: { avg: "points" },
  lowest: { min: "points" },
  highest: { max: "points" },
  n: { count: "points" },
}).execute();

const { average, lowest, highest, n } = rows[0].aggregations;
```

## Grouping with groupBy

Call `.groupBy()` with one or more scalar fields, then `.aggregate()` to compute values per group.
The grouped fields are available on each row's `fields` object.

```typescript
const rows = await client.data.Todo.groupBy(["priority"])
  .aggregate({
    total: { sum: "points" },
    n: { count: "points" },
  })
  .execute();

for (const row of rows) {
  console.log(row.fields.priority, row.aggregations.total, row.aggregations.n);
}
```

## Filtering before aggregating

Chain `.where()` before `.aggregate()` to aggregate only the filtered rows.

```typescript
const rows = await client.data.Todo.where({ priority: { neq: "low" } })
  .aggregate({ total: { sum: "points" } })
  .execute();
```

## having and distinct options

Use the options form of an operation to add a `having` filter on the aggregated value or to aggregate only `distinct` values.

```typescript
const rows = await client.data.Order.groupBy(["region"])
  .aggregate({
    revenue: { sum: "amount" },
    bigOrders: { max: { field: "amount", having: { gt: 500 } } },
    distinctAmounts: { count: { field: "amount", distinct: true } },
  })
  .execute();
```

## Constraints

Grouped aggregation and row selection are mutually exclusive queries in DAB.
Calling `.aggregate()` after `.select()`, `.first()`, `.after()`, or `.orderBy()` throws a runtime error.
Apply `.where()` before `.aggregate()`; row-level ordering and pagination do not apply to aggregated results.
