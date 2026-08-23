---
symbols: ['entity', 'text', 'uuid', 'int', 'decimal', 'boolean', 'date', 'one', 'many', 'role', 'anonymous', 'authenticated']
---

# @microsoft/rayfin-core

Core decorators that store runtime metadata for data model definitions.
The Rayfin CLI reads this metadata to generate Data API Builder (DAB)
configuration.

This package contains:

- **Type decorators**: `@text()`, `@uuid()`, `@int()`, `@decimal()`,
  `@boolean()`, `@date()`, `@set()`, `@email()`
- **Relationship decorators**: `@one()`, `@many()` (pass `() => Target`
  for circular references)
- **Permission decorators**: `@role()`, `@anonymous()`, `@authenticated()`
- **Class decorators**: `@entity()`, `@blob()`

See [decorators](./decorators.md) for the full reference and
[permissions](./permissions.md) for the role/policy model.

## Installation

```bash
npm install @microsoft/rayfin-core
```

The package targets modern Node.js (20+) and TypeScript with ES2024 +
TC39 Stage 3 decorator metadata. No `reflect-metadata` is needed.

## Quickstart

```typescript
import { entity, text, uuid, int } from '@microsoft/rayfin-core';

@entity()
export class Todo {
  @uuid() id!: string;
  @text() title!: string;
  @int() priority!: number;
  @text({ optional: true }) notes?: string;
}
```

The Rayfin CLI inspects the decorated class and generates a DAB-compliant
configuration entry for the `Todo` entity automatically.
