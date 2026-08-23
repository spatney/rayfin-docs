---
symbols: ['role', 'anonymous', 'authenticated']
---

# Permissions and roles

`@microsoft/rayfin-core` provides class-level permission decorators that
record DAB role/action mappings. Only the two built-in roles are
supported: `anonymous` and `authenticated`.

## `@anonymous(action)` / `@authenticated(action, options?)`

Grant a built-in role one or more DAB actions: `'read'`, `'create'`,
`'update'`, `'delete'`, or `'*'` (all).

```typescript
import { entity, anonymous, authenticated, uuid, text } from '@microsoft/rayfin-core';

@entity()
@anonymous('read')
@authenticated('*')
class Article {
  @uuid() id!: string;
  @text() title!: string;
}
```

## Field visibility — `include` and `exclude`

Limit which fields a role can see or write to.

```typescript
@entity()
@authenticated('*', { exclude: ['secret'] })
class Document {
  @uuid() id!: string;
  @text() title!: string;
  @text({ optional: true }) secret?: string;
}
```

## Row-level policy — typed policy DSL

Pass a `policy` callback to `@authenticated` (or `@role` for advanced
cases). The callback receives a typed `claims` object and the row
shape and compiles to a DAB `policy.database` string.

```typescript
import { entity, authenticated, uuid, text } from '@microsoft/rayfin-core';

@entity()
@authenticated('*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
class Document {
  @uuid() id!: string;
  @text() owner_id!: string;
  @text() title!: string;
}
```

The policy DSL supports equality, comparison, and boolean composition;
the typing surface is enforced by the entity's field metadata so a
typo on a field name fails at compile time.
