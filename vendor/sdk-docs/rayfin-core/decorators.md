---
symbols: ['entity', 'text', 'uuid', 'int', 'decimal', 'boolean', 'date', 'set', 'email', 'one', 'many']
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

### Reserved entity names

An entity name becomes a GraphQL type name, and type names are global across the generated schema.
Naming an entity after a type the schema already defines redefines that type, so the CLI rejects the entity before the schema is applied.
This applies to owned `rayfin/data/` entities and to connector entities alike.

Matching is case-sensitive and exact, so `TaskDate` and `OrderDate` are fine while `Date` is not.

Reserved: `Any`, `Base64String`, `Boolean`, `Byte`, `ByteArray`, `Date`, `DateTime`, `Decimal`, `Duration`, `Float`, `ID`, `Int`, `LocalDate`, `LocalDateTime`, `LocalTime`, `Long`, `Mutation`, `Query`, `Short`, `SignedByte`, `Single`, `String`, `Subscription`, `Time`, `TimeSpan`, `UnsignedByte`, `UnsignedInt`, `UnsignedLong`, `UnsignedShort`, `URI`, `URL`, `UUID` — plus any name starting with `__`.

To resolve a collision, rename the class or pass an explicit name to `@entity()`:

```typescript
@entity('DateRecord')
export class DateRecord {
  @text() label!: string;
}
```

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
Import each target entity as a runtime value, not with `import type`.
Type-only imports are erased during compilation, so the lazy callback would
resolve to `undefined` when Rayfin reads the relationship metadata.

```typescript
// Project.ts
import { entity, uuid, many } from '@microsoft/rayfin-core';
import { Task } from './Task.js';

@entity()
export class Project {
  @uuid() id!: string;
  @many(() => Task) tasks?: Task[];
}
```

```typescript
// Task.ts
import { entity, uuid, one } from '@microsoft/rayfin-core';
import { Project } from './Project.js';

@entity()
export class Task {
  @uuid() id!: string;
  @one(() => Project) project!: Project;
}
```

Each file imports the other as a runtime value. The cycle is safe because the
`() => Target` callback defers resolution until after both modules have
finished evaluating.
