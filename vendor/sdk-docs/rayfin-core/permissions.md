---
symbols: ['role', 'anonymous', 'authenticated']
---

# Permissions and roles

`@microsoft/rayfin-core` provides class-level permission decorators that
record DAB role/action mappings. Only the two built-in roles are
supported: `anonymous` and `authenticated`.

## Fabric prerequisite for anonymous data access

The anonymous decorators always record their permission metadata, but the host decides whether to accept an anonymous schema.
On Microsoft Fabric, a tenant administrator must turn on **Enable anonymous data access for Fabric Apps (Preview)** for the app owner.
Otherwise, applying the schema fails with HTTP 403 (`ANONYMOUS_DATA_ACCESS_BLOCKED_BY_TENANT_ADMIN`).
The setting covers the data API only; it does not make a static-hosted frontend public.

If your tenant does not allow anonymous data access, use `@authenticated(...)` instead and sign users in from your frontend.
The Rayfin guide's `data/permissions.md` describes the full behavior.

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

Store `claims.sub` in a text field such as `owner_id`.
The subject claim is an opaque string and is not guaranteed to be a UUID.
Use `@uuid()` only for fields that reference UUID entity keys.

Policies validate access but do not populate owner fields.
Set the owner field from the authenticated session when creating a row:

```typescript
const session = client.auth.getSession();
if (!session.isAuthenticated || !session.user) {
  throw new Error('Not signed in.');
}

await client.data.Document.create({
  title: 'Project plan',
  owner_id: session.user.id,
});
```

The policy DSL supports equality, comparison, and boolean composition;
the typing surface is enforced by the entity's field metadata so a
typo on a field name fails at compile time.
