---
symbols: ['entity', 'text', 'uuid', 'int', 'decimal', 'boolean', 'date', 'set', 'email', 'one', 'many', 'blob']
---

# Decorator reference

`@microsoft/rayfin-core` provides decorators that store metadata at
runtime via `Symbol.metadata`. The CLI reads this metadata to generate
the DAB configuration for your entities.

## Class decorators

### `@entity()`

Marks a class as a DAB entity. Required on every class you want exposed
through the data API.

```typescript
import { entity, text } from '@microsoft/rayfin-core';

@entity()
export class Project {
  @text() name!: string;
}
```

### `@blob()`

Marks a class as a blob storage entity (used with `@microsoft/rayfin-storage`).

## Type decorators

Use type-specific decorators on class fields. Each decorator records the
field's DAB type and any metadata options.

### `@text(options?)`

Variable-length text. Accepts `optional`, `default`, `description`, etc.

```typescript
@text() name!: string;
@text({ optional: true }) description?: string;
@text({ default: 'pending' }) status!: string;
```

### `@uuid(options?)`

UUID identifier. Conventionally used for primary keys.

```typescript
@uuid() id!: string;
```

### `@int(options?)`

Integer. Accepts the standard `BaseFieldOptions`.

### `@decimal(options?)`

Fixed-point decimal.

### `@boolean(options?)`

Boolean.

### `@date(options?)`

ISO-8601 date/time.

### `@set(...values)`

String enum. Accepts a list of allowed string literal values.

```typescript
@set('todo', 'in-progress', 'done') status!: 'todo' | 'in-progress' | 'done';
```

### `@email(options?)`

Email address (text with email-shaped validation downstream).

## Relationship decorators

Use `@one(() => Target)` and `@many(() => Target)` with the lazy
`() => Target` form to support circular references between entities
in different files.

```typescript
import { entity, uuid, one, many } from '@microsoft/rayfin-core';

@entity()
export class Project {
  @uuid() id!: string;
  @many(() => Task) tasks?: Task[];
}

@entity()
export class Task {
  @uuid() id!: string;
  @one(() => Project) project!: Project;
}
```
