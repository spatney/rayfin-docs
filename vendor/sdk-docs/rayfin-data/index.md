---
symbols: []
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

This stub will expand in follow-up PRs as per-package docs are authored.
The Phase 2 + Phase 3 milestone for this package is the package-level
convention contract: declare `rayfinDocs` in `package.json`, ship a
`assets/docs/` directory, let `@microsoft/rayfin-docs` discover it
automatically.

## GraphQL query paging

Rayfin's fluent GraphQL client sends Data API Builder compatible collection queries.
Collection queries return one page at a time.
If you do not specify a page size, Rayfin returns a default page of 100 records.

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
