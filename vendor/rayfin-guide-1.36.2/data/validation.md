---
sidebar_position: 4
---

# Form Validation

Rayfin can generate a [Standard Schema](https://standardschema.dev) validator directly from your decorated entity classes.
This lets you validate form input on the client without adding a separate validation library like Zod or Yup.

> **Note:** Rayfin entities use TC39 Stage 3 decorators, so any build tooling that compiles your client code must target **ES2022** (or later).
> If you see `Expression expected` errors on `@entity()` (or other decorators) when calling `toStandardSchema` or `getFieldConstraints`, your bundler is compiling to an older target.
> For Vite, set `target: 'es2022'` in your `vite.config.ts` — see [Vite configuration](../getting-started/project-structure.md#vite-configuration) — and use the default `@vitejs/plugin-react` (esbuild) plugin, since `@vitejs/plugin-react-swc` does not support these decorators regardless of the `target` setting.

## Build a validator from an entity

Use `toStandardSchema` to create a validator from any `@entity()` class.
The `id` field and relationship navigation properties (`@one`, `@many`) are automatically excluded — you only need to list additional fields your form does not collect.

```typescript
import { toStandardSchema } from '@microsoft/rayfin-core';
import { Todo } from '../rayfin/data/Todo.js';

// id is auto-omitted. List fields you want to omit from validation.
const todoInputSchema = toStandardSchema(Todo, {
  omit: ['createdAt', 'updatedAt'] as const,
});
```

The returned object implements the Standard Schema v1 contract (`~standard`) so it works with any compatible library (TanStack Form, Conform, tRPC v11, and others).
It also exposes a convenience `.validate()` method for direct use.

## Validate form input

Call `.validate()` with your form values.
The result is either `{ value }` on success or `{ issues }` on failure.

```typescript
const result = todoInputSchema.validate({
  title: title.trim(),
  isCompleted: false,
  priority: 'medium',
});

if (result.issues) {
  // Map issues to per-field errors by path[0]
  const errors: Record<string, string> = {};
  for (const issue of result.issues) {
    const key = String(issue.path?.[0] ?? '_');
    if (!errors[key]) errors[key] = issue.message;
  }
  // Display errors in the UI
} else {
  // result.value is typed as Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
  await api.createTodo(result.value);
}
```

Validation is synchronous.
All checks (type guards, string length, regex, enum membership) run in memory with no async overhead.

## Read field constraints for UI hints

Use `getFieldConstraints` to read the decorator constraints for a single field.
This is useful for displaying character counters, limit labels, or other UI hints without building a full schema.

```typescript
import { getFieldConstraints } from '@microsoft/rayfin-core';
import { Todo } from '../rayfin/data/Todo.js';

const titleConstraints = getFieldConstraints(Todo, 'title');
// { type: 'string', min: 1, max: 50, optional: false }

const maxLength =
  titleConstraints?.type === 'string' ? titleConstraints.max : undefined;
```

The field name is type-checked against the entity — typos are caught at compile time.

## What gets validated

The validator checks each field based on its decorator:

| Decorator | Checks |
| --- | --- |
| `@text()` | Is a string. Enforces `min`, `max`, and `regex` when specified. |
| `@uuid()` | Is a string matching the UUID format. |
| `@email()` | Is a string matching a practical email pattern. |
| `@int()` | Is a finite integer. Enforces `min` and `max` bounds. |
| `@decimal()` | Is a finite number. Enforces `min` and `max` bounds. |
| `@boolean()` | Is a boolean. |
| `@date()` | Is a `Date` object, ISO string, or numeric timestamp. |
| `@set()` | Value is one of the declared enum literals. |

Required fields (the default) produce a "required" issue when missing or `null`.
Optional fields (`{ optional: true }`) are silently skipped when absent.
Unknown fields not declared on the entity are rejected.

## Auto-omit behavior

`toStandardSchema` automatically excludes:

- The `id` primary key — typically server-generated, never part of a form.
- Relationship navigation properties (`@one`, `@many`) — not form inputs.

Pass additional field names in the `omit` option for other server-managed fields like timestamps or `user_id`.
The `omit` array is type-safe — misspelled field names are caught at compile time.

```typescript
// Only need to list fields beyond id and relationships
const schema = toStandardSchema(Note, {
  omit: ['createdAt', 'updatedAt', 'user_id'] as const,
});
```

## Complete React example

```tsx
import { useMemo, useState } from 'react';
import { toStandardSchema, getFieldConstraints } from '@microsoft/rayfin-core';
import { Todo } from '../rayfin/data/Todo.js';

export function TodoForm({ onSubmit }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const todoInputSchema = useMemo(
    () => toStandardSchema(Todo, { omit: ['createdAt', 'updatedAt'] as const }),
    []
  );

  const titleConstraints = getFieldConstraints(Todo, 'title');
  const maxLength =
    titleConstraints?.type === 'string' ? titleConstraints.max : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = todoInputSchema.validate({ title: title.trim() });
    if (result.issues) {
      setError(result.issues[0].message);
      return;
    }
    setError('');
    await onSubmit(result.value);
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      {maxLength && <span>{title.length}/{maxLength}</span>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">Add</button>
    </form>
  );
}
```

## Standard Schema interop

The object returned by `toStandardSchema` implements `StandardSchemaV1` from `@standard-schema/spec`.
Any library that reads the `~standard` property can consume it directly.

```typescript
// TanStack Form, Conform, tRPC v11, etc. read ~standard automatically.
// You can also access it explicitly if needed:
const result = todoInputSchema['~standard'].validate(formValues);
```

The `RayfinStandardSchema` and `StandardSchemaV1` types are re-exported from `@microsoft/rayfin-core` so you do not need a direct dependency on `@standard-schema/spec`.
