---
sidebar_position: 1
---

# Configure Rayfin Data Models

In this guide, you will learn how to set up your data schema and define your data models.
Each data model is defined with `@entity()` decorator.
You can secure your API with authorization rules using `@role()` (or the `@anonymous()` and `@authenticated()` shorthands).

## Tables as Entity

Add `@entity()` decorator to define your model.
Import the types you need from `rayfin-core`.

**Example**

```typescript
import { entity, authenticated, uuid, text, date, many, boolean } from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Notebook {
  @uuid() id!: string;
  @text() name!: string;
  @text({ optional: true }) description?: string;
  @text({ optional: true }) color?: string;
  @boolean() isDefault!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @many(() => Note) notes?: Note[];
  @text() user_id!: string;
}
```

- Every entity has an `id` field typed as `string` that serves as the UUID primary key.
If you do not declare `id` explicitly, Rayfin adds it to your schema automatically.
The `id` is optional when creating items — the server generates one if omitted.
- Policies can reference identifiers in JWT claims via the typed DSL.
Only `sub`, `email`, and `role` are supported claims.

## Entity primary key

Every Rayfin entity uses a UUID `string` field named `id` as its primary key.
If you do not declare `id` in your entity class, Rayfin adds it to the schema automatically.
You do not need to mark the field with any special option.

- Optionally declare `id` as `@uuid() id!: string;` if you want it visible in your TypeScript class.
- The `id` field is **optional during create operations**.
If you omit it, the server generates a UUID automatically.
- You may supply your own UUID at creation time if you prefer client-generated identifiers.
- Composite or non-`id` primary keys are not supported.

```typescript
@entity()
export class Todo {
  @uuid() id!: string; // UUID primary key, auto-generated when omitted
  @text() title!: string;
}
```

## Data types supported

Developer should be able to define the types as shown below that will allow us to define the schema when applying to the database.

| Decorator | Logical type | Notes |
| --- | --- | --- |
| `@uuid()` | UUID | Unique identifier. |
| `@text()` | string | String fields. On MSSQL, omitting `max` produces `NVARCHAR(MAX)` columns which can cause GraphQL schema generation failures at deploy time. Always specify `max` — e.g., `@text({ max: 200 })`. |
| `@int()` | int | Integer type. |
| `@decimal()` | decimal | Decimal or numeric type, depending on dialect. |
| `@boolean()` | boolean | True or false type. |
| `@date()` | datetime | Serializes from ISO strings or `Date` objects. |
| `@email()` | string | Text field with email validation. |
| `@set()` | enum | Enumerated set of string literals. |

## Type modifiers

You can add modifiers to the your fields based on the type of the field.

- `{optional: boolean}` — make the field nullable in the database.
Fields are required (non-nullable) by default; use `{ optional: true }` to explicitly allow NULL values.
- `{unique: boolean}` — add a unique constraint for this field.
- `{default: value}` — default value expression for the column.
- `{max: n}`, `{min: n}` — string length constraints (also used for numeric range constraints).
- `{pattern: "regex"}` — string validation pattern.

## Relationships and Ownership

One to many and many to one are supported with Rayfin.
Use `@one(() => Parent)` and `@many(() => Child)` to describe navigation properties without writing SQL joins.
Many to many currently is not supported.

Rayfin auto-generates relationship columns when you define navigation decorators.
Define foreign key fields only if you need to read or set them in application code.
When you do define them, use the `{property}_id` naming convention.

**Example**

```typescript
import { entity, authenticated, text, set, date, uuid, boolean, one } from '@microsoft/rayfin-core';
import { Notebook } from './Notebook.js';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Note {
  @uuid() id!: string;
  @text() title!: string;
  @text() content!: string;
  @set('markdown', 'html', 'plaintext')
  contentType!: 'markdown' | 'html' | 'plaintext';
  @boolean() isPinned!: boolean;
  @boolean() isArchived!: boolean;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
  @uuid() notebook_id!: string;
  @one(() => Notebook, { optional: true }) notebook?: Notebook;
  @text() user_id!: string;
}
```

When authoring entity files, use `.js` extensions for relative imports so the emitted ESM JavaScript resolves correctly.

## Using relationships in CRUD operations

After defining `@one()` and `@many()` relationships, you can create or update related entities by passing either a full object or an ID-only object.
The ID-only shape is the recommended shorthand for most write operations.

```typescript
await client.data.Note.create({
  title: 'Draft architecture review',
  content: 'Outline relationship behavior',
  notebook: { id: 'notebook-123' },
});

await client.data.Note.update(
  { id: 'note-456' },
  {
    notebook: { id: 'notebook-789' },
  }
);
```

You can still pass a full related object when you already have it available.
Both forms are supported and produce equivalent relationship updates.

```typescript
await client.data.Note.create({
  title: 'Weekly summary',
  content: 'Use full object when convenient',
  notebook: {
    id: 'notebook-123',
    name: 'Work',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    user_id: 'user-1',
  },
});
```

For complete mutation examples and response behavior, see [Use GraphQL Query Builder](./graphql.md).

## Schema registration

`schema.ts` binds entity names to their classes so `RayfinClient` can provide GraphQL proxies.

```typescript
import type { Note } from './Note.js';
import type { Notebook } from './Notebook.js';

export type NotesAppSchema = {
  Note: Note;
  Notebook: Notebook;
};
```

Add every new entity to this map and update the exported type wherever it is imported (most commonly in service factories).

## Applying Model Changes

Ensure the correct backend is running and ports are free before applying.
If you switch templates or database dialects, stop or purge stale services to avoid hitting the wrong endpoint.

1. Redeploy with `npx rayfin up` and wait for services to be healthy.
2. Regenerate the schema by running `npx rayfin up db apply`.
3. Refresh the frontend client.

The regeneration step updates tables, relationships, and permissions so subsequent API calls reflect your latest decorators.

## Authorization rules using `@role()`

Rayfin uses class-level role decorators to generate Data API Builder (DAB) permissions.
Use `@role()` directly, or the `@anonymous()` and `@authenticated()` shorthands.

### Public read, authenticated write

Grant unauthenticated callers read access with `@anonymous('read')` while
keeping writes restricted to the owning authenticated user.

```typescript
import { entity, anonymous, authenticated, uuid, text } from '@microsoft/rayfin-core';

@entity()
@anonymous('read')
@authenticated(['create', 'read', 'update', 'delete'], {
  policy: (claims, item) => claims.sub.eq(item.user_id),
})
export class Todo {
  @uuid() id!: string;
  @text() title!: string;
  @text() user_id!: string;
}
```

### Field visibility

Use `include` or `exclude` in the role options to control which fields are visible for that role.

```typescript
import { entity, authenticated, uuid, text } from '@microsoft/rayfin-core';

@entity()
@authenticated('read', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
  exclude: ['secret'],
})
export class Document {
  @uuid() id!: string;
  @text() owner_id!: string;
  @text() title!: string;
  @text({ optional: true }) secret?: string;
}
```

### Notes

- `@role()` applies to classes.
Field visibility is configured through role options.
- Only the built-in roles are supported today: `anonymous` and `authenticated`.
- To use anonymous data with Microsoft Fabric, please reach out to your tenant admin to enable the tenant admin switch "Enable anonymous data access for Fabric Apps"

## Best practices

- Include a `user_id` field when using per-user policies.
- Start with restrictive permissions and expand as needed.
- Use separate `@role()` entries when field visibility differs by action.
- Prefer `@anonymous()` and `@authenticated()` shorthands for built-in roles.

## Troubleshooting Checklist

- Missing relationships usually mean the navigation decorator is absent or the schema was not applied; foreign keys are generated automatically unless you define them explicitly.
- Authorization failures often trace back to mismatched claim names, so log the decoded JWT when debugging policies.
- If the frontend still returns stale shapes, delete `rayfin/.temp/` within the sample and rerun `npx rayfin up` to force regeneration.

Use these patterns as building blocks for any Rayfin-powered application and iteratively refine the model as product requirements evolve.
