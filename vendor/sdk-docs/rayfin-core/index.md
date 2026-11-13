---
symbols: ['entity', 'text', 'uuid', 'int', 'decimal', 'boolean', 'date', 'one', 'many', 'role', 'anonymous', 'authenticated', 'blob', 'StorageObject', 'ContentTypes', 'bytes', 'kb', 'mb', 'gb', 'BlobFolderOptions', 'ByteSize', 'MimeGlob']
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
- **Class decorators**: `@entity()`

See [decorators](./decorators.md) for the full reference and
[permissions](./permissions.md) for the role/policy model.
Before using anonymous data permissions on Microsoft Fabric, see the [Fabric prerequisite](./permissions.md#fabric-prerequisite-for-anonymous-data-access).

## Installation

```bash
npm install @microsoft/rayfin-core
```

The package targets modern Node.js (20+) and TypeScript with ES2024 +
TC39 Stage 3 decorator metadata. No `reflect-metadata` is needed.

## Storage imports

Import Storage declarations and constraints from `@microsoft/rayfin-core`.
This release removes their legacy re-exports from `@microsoft/rayfin-core/experimental/index`.
Existing apps must move `blob`, `StorageObject`, `ContentTypes`, `bytes`, `kb`, `mb`, `gb`, and the types `BlobFolderOptions`, `ByteSize`, and `MimeGlob` to root imports before rebuilding:

```typescript
import {
  blob,
  StorageObject,
  ContentTypes,
  mb,
  type BlobFolderOptions,
} from '@microsoft/rayfin-core';
```

The Storage implementations are unchanged; only the legacy import path has been removed.
Move only Storage symbols; experimental auth claim imports such as `RayfinCustomClaims` and `ClientClaims` remain on `@microsoft/rayfin-core/experimental/index`.

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
