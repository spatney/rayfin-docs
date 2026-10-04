---
sidebar_position: 2
---

# Read and Write Data with the GraphQL Client

Rayfin's supports GraphQL fluent client lets you run create, read, update, and delete operations with full type safety and zero handwritten queries.
Once you have your data models defined follow the guidance below to build out the front end of your app and use the data API client to perform read, write, update, or delete data.

## Instantiate a RayfinClient

Use `RayfinClient` to connect your frontend or Node.js service to the Rayfin backend.
The generic arguments keep strong typing across REST, GraphQL fluent, and raw GraphQL clients.

In most applications you should create a single client instance and reuse it.
This is commonly implemented as a small singleton module or service wrapper.

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import type { Note } from '../rayfin/data/Note';

type AppSchema = { Note: Note };

const rayfinClient = new RayfinClient<AppSchema>({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL ?? 'http://localhost:5168',
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY ?? '',
});
```

## Read Data with GraphQL

Rayfin's fluent client produces DAB-compliant GraphQL and returns typed entities.

The GraphQL fluent client is available as `client.data.<Entity>`.
Some older examples may show `client.data.gql.<Entity>`.

Required `@text()` fields return an empty string when the stored value is empty.
Optional `@text({ optional: true })` fields preserve `null` so apps can distinguish an intentionally missing value from empty text.

### Read multiple records

Here is an example to read records and order by a column.

```typescript
const notes = await this.rayfinClient.data.Note.select([
  'id',
  'title',
  'content',
  'contentType',
  'isPinned',
  'isArchived',
  'createdAt',
  'updatedAt',
  'user_id',
  'notebook_id',
  'notebook.id',
  'notebook.name',
  'notebook.color',
])
  .orderBy({ createdAt: 'desc' })
  .execute();

// Sort pinned notes to the top
return this.sortWithPinnedFirst(notes);
```

> **`.execute()` returns a single page (100 records by default).**
> The Data API caps a single response at its default page size (100 records).
> `.first(n)` raises the page size, but `.execute()` still returns only that one page and does **not** signal whether more records exist - so a list longer than the page is silently truncated.
> If your entity can grow beyond a single page (or you need a guaranteed-complete result set), use [pagination](#paginate-large-lists) instead of `.execute()`.

### Filter records

Use `where` to filter results.

```typescript
const pinnedNotes = await this.rayfinClient.data.Note.select([
  'id',
  'title',
  'isPinned',
])
  .where({ isPinned: { eq: true } })
  .orderBy({ createdAt: 'desc' })
  .execute();
```

### Paginate Large Lists

Because `.execute()` returns only a single page (100 records by default) and gives no indication that more exist, use cursor pagination whenever a query can return more than one page.
Pagination uses `.first(n)` to set the page size and `.executePaginated()` to return one page plus the cursor metadata needed to fetch the next one.

**When to paginate vs. when `.execute()` is fine:**

- Use `.execute()` only for queries you know are bounded under one page (for example a `.where(...)` filter that can match at most a handful of rows, or a small lookup table).
- Use pagination for any unbounded or growing list - a user's notes, an order history, a product catalog. When in doubt, paginate.
- If you are building a UI list and aren't sure how large it will get, ask the user whether they want infinite scroll / a "load more" button (page-at-a-time) or the complete set up front (loop until `hasNextPage` is `false`, shown below).

**Fetch a single page:**

```typescript
const page = await this.rayfinClient.data.Note.select([
  'id',
  'title',
  'createdAt',
])
  .orderBy({ createdAt: 'desc' })
  .first(25)
  .executePaginated();

const items = page.items; // up to 25 records
const cursor = page.endCursor; // pass to .after(cursor) for the next page
const hasNextPage = page.hasNextPage; // true if more records remain
```

**Fetch the next page** by passing the previous `endCursor` to `.after()`:

```typescript
const nextPage = await this.rayfinClient.data.Note.select(['id', 'title', 'createdAt'])
  .orderBy({ createdAt: 'desc' })
  .first(25)
  .after(cursor)
  .executePaginated();
```

**Fetch every record** by repeating the call in a loop, passing each page's `endCursor` to `.after()`, until `hasNextPage` is `false`.
Keep the `.select()`, `.where()`, and `.orderBy()` clauses identical across pages - a stable sort order is required for the cursor to advance correctly.

> **`.first(n)` is bounded by DAB's maximum page size (100,000).**
> Rayfin returns a single default page of 100 records when a query omits `.first(n)`.
> For large result sets, the recommended pattern is to page through results with `.after()` rather than requesting everything in one large `.first(n)`.
> `.first(-1)` requests an unbounded page (all matching records), which DAB still caps at the maximum - so it works only when the full result set fits under that limit.

### Fetch a Single Record

Here is an example to fetch a single record.

```typescript
const note = await rayfinClient.data.Note.findById('00000000-0000-0000-0000-000000000000');
```

## Create Records

Use `create` to insert a record with full validation based on your entity definition.
The returned value is the newly created entity.

```typescript
const noteData = {
  title: 'My first note',
  content: 'test note',
  isPinned: false,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const newNote = await this.rayfinClient.data.Note.create(noteData);
```

### Creating Records with Relationships

When creating entities that have relationships (defined with `@one()`), you can pass either the full related object or just an object with the primary key.

**Option 1: Pass the full object**

```typescript
// If you already have the full Notebook object
const notebook = await rayfinClient.data.Notebook.findFirst({ name: { eq: 'Work' } });

const note = await rayfinClient.data.Note.create({
  title: 'Meeting notes',
  content: 'Discussion points...',
  isPinned: false,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  notebook: notebook,  // Full object
});
```

**Option 2: Pass an object with just the ID**

```typescript
// If you only have the notebook ID (avoids extra fetch)
const note = await rayfinClient.data.Note.create({
  title: 'Meeting notes',
  content: 'Discussion points...',
  isPinned: false,
  isArchived: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  notebook: { id: 'notebook-id' },  // Just the primary key
});
```

Both forms produce the same GraphQL mutation.
The second form is useful when you already know the related entity's ID and don't need to fetch the full object.

## Update Records

Use `update` to patch records by filter.

```typescript
const noteUpdates = {
  ...updates,
  updatedAt: new Date(),
};

await this.rayfinClient.data.Note.update({ id }, noteUpdates);
```

### Updating Records with Relationships

When updating a relationship field (defined with `@one()`), you can pass either the full related object or just an object with the primary key — the same options available when creating.

```typescript
// Move a note to a different notebook by passing just the ID
await rayfinClient.data.Note.update(
  { id: '00000000-0000-0000-0000-000000000000' },
  { notebook: { id: 'new-notebook-id' } },
);
```

The client converts the relationship object to a foreign key field (`notebook_id`) in the generated GraphQL mutation.

## Delete Records

Use `delete` to remove records that match a filter.
The method resolves when the backend confirms deletion.

```typescript
await this.rayfinClient.data.Note.delete({ id });
```

## Limitations and Workarounds

- `.execute()` returns only a single page (100 records by default) and does not signal whether more records exist, so lists longer than one page are silently truncated.
Use `.first(n)` with `.executePaginated()` and `.after(endCursor)` to page through the full result set.
- `count()` is not implemented today; select the identifiers you need and use `results.length` or a custom aggregate.
- `totalCount` appears on the `PagedResult` type but DAB does not populate it in paginated queries.

## Seed Data Scripts

Use `RayfinClient` in a Node.js script to populate data for development and testing.
Read the base URL and publishable key from your project's `.env` file — never hardcode them.

```typescript
import { readFileSync } from 'fs';
import { RayfinClient } from '@microsoft/rayfin-client';
import type { AppSchema } from '../rayfin/data/schema';

// Read connection details from .env (generated by rayfin up)
function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of readFileSync('.env', 'utf-8').split('\n')) {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) vars[match[1].trim()] = match[2].trim();
  }
  return vars;
}

const env = loadEnv();
const client = new RayfinClient<AppSchema>({
  baseUrl: env['VITE_RAYFIN_API_URL'],
  publishableKey: env['VITE_RAYFIN_PUBLISHABLE_KEY'],
  authStorage: false, // Optional — Node.js has no localStorage but Auth auto-detects
});

async function seed() {
  // Sign up and sign in (email/password works for local dev only)
  try {
    await client.auth.signUp({ email: 'admin@example.com', password: 'Admin123!' });
  } catch { /* user may already exist */ }
  await client.auth.signIn({ email: 'admin@example.com', password: 'Admin123!' });

  // Create entities — parent records first, then children referencing their IDs
  const notebook = await client.data.Notebook.create({
    name: 'Work',
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await client.data.Note.create({
    title: 'First note',
    content: 'Hello world',
    isPinned: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    notebook: { id: notebook.id },
  });
}

seed().catch(console.error);
```

Run with `npx tsx scripts/seed.ts`, or add `"seed": "npx tsx scripts/seed.ts"` to `package.json`.

Key rules:

- Set `authStorage: false` — disables session persistence in Node.js scripts.
  This is optional since Auth now auto-detects Node.js and falls back to memory-only storage, but explicit `false` makes intent clear.
- Read `baseUrl` and `publishableKey` from `.env`, not hardcoded values — the port and key vary per project.
- Email/password auth works for **local development seeding only**.
  Deployed Fabric apps use Entra SSO exclusively.
