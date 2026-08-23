---
sidebar_position: 3
---

# Data permissions

Rayfin uses the `@role` decorator to attach authorization rules directly to your data models.
Permissions are type-safe, refactor-friendly, and compiled into Data API Builder (DAB) configuration automatically.

## Built-in roles

Rayfin recognizes two built-in roles:

- **anonymous** — public access without authentication.
- **authenticated** — requires a valid user session.

## The `@role` decorator

Apply `@role` at the class level to control which roles can perform which actions on an entity.

```typescript
@role(roleName, actions, options?)
```

| Parameter | Description |
| --- | --- |
| `roleName` | The role name (`'anonymous'` or `'authenticated'`). |
| `actions` | A single action or array of actions: `'create'`, `'read'`, `'update'`, `'delete'`, or `'*'` for all. |
| `options` | Optional object with `check`, `include`, and `exclude` properties. |

## Basic example

Grant anonymous users read access and restrict authenticated users to their own data:

```typescript
import { entity, role, uuid, text } from '@microsoft/rayfin-core';

@entity()
@role('anonymous', 'read')
@role('authenticated', ['create', 'read', 'update', 'delete'], {
  check: (claims, item) => claims.sub.eq(item.user_id),
})
export class Todo {
  @uuid() id!: string;
  @text() title!: string;
  @text() description?: string;
  @text() user_id!: string;
}
```

In this example, authenticated users can only access Todo items where `user_id` matches their JWT `sub` claim.

## Type-safe policy expressions

The `check` callback provides typed access to both claims and entity fields.
TypeScript infers the entity type from the decorated class, so you get autocompletion and refactor safety with no extra configuration.

```typescript
check: (claims, item) => claims.sub.eq(item.user_id)
```

### Supported claims

| Claim | Description |
| --- | --- |
| `claims.sub` | Subject identifier (user ID). |
| `claims.email` | User email address. |
| `claims.role` | User role. |

### Expression operators

| Operator | Example | DAB output |
| --- | --- | --- |
| `.eq()` | `claims.sub.eq(item.user_id)` | `@claims.sub eq @item.user_id` |

### Logical operators

Combine expressions with `.and()` and `.or()`:

```typescript
check: (claims, item) =>
  claims.sub.eq(item.user_id).and(item.isActive.eq(true))
```

Both sides are parenthesized automatically, so grouping is always explicit:

```typescript
// (claims.role eq 'admin') or (claims.sub eq @item.owner_id)
check: (claims, item) =>
  claims.role.eq('admin').or(claims.sub.eq(item.owner_id))
```

## Field-level permissions

Control which fields a role can access using `include` or `exclude` in the role options.

### Include specific fields

Only allow the `Title` field during create:

```typescript
@role('authenticated', 'create', {
  check: (claims, item) => claims.sub.eq(item.createdBy),
  include: ['Title'],
})
```

### Exclude specific fields

Hide sensitive fields from read operations:

```typescript
@role('authenticated', 'read', {
  check: (_claims, item) => item.IsAdmin.eq(false),
  exclude: ['last_login'],
})
```

Field arrays are typed to the entity's actual property names.
Renaming a field produces a compile-time error in every `include` or `exclude` list that references it.

## Action-specific permissions

Apply different rules per action by using multiple `@role` decorators with single actions:

```typescript
@entity()
@role('anonymous', 'read')
@role('authenticated', 'create', {
  check: (claims, item) => claims.sub.eq(item.createdBy),
  include: ['Title'],
})
@role('authenticated', 'read', {
  check: (claims, item) => claims.sub.eq(item.createdBy),
})
@role('authenticated', 'update', {
  check: (claims, item) => claims.sub.eq(item.createdBy),
  exclude: ['adminContent'],
})
export class SecureDocument {
  @uuid() id!: string;
  @text() Title!: string;
  @text({ optional: true }) adminContent?: string;
  @text() createdBy!: string;
}
```

## Storage permissions

The same `@role` decorator works with storage entities.
When applied to a `@blob()` class, Rayfin generates a storage policy instead of a database policy:

```typescript
import { blob, role } from '@microsoft/rayfin-core';

@blob()
@role('authenticated', '*', {
  check: (claims, item) => claims.sub.eq(item.owner_id),
})
export class ProfileImage {
  owner_id!: string;
}
```

## How it works

- The `@role` decorator collects permission metadata at class definition time.
- When you run `npx rayfin up db apply`, the CLI reads that metadata and generates DAB-compliant permission entries in the configuration.
- Policy callbacks are compiled into DAB OData-style policy strings (for example `@claims.sub eq @item.user_id`).
- Field `include`/`exclude` arrays map directly to DAB field permission configuration.
- Multiple `@role` decorators on the same class are aggregated per role.
  Conflicting declarations produce a warning at generation time.
