---
sidebar_position: 80
---

# Known Limitations

Current limitations and recommended workarounds for Rayfin Builders.

## Data Client

- `count()` is not available on the fluent GraphQL client.
Select minimal fields and compute `results.length` instead.
- Many-to-many relationships are not supported.
Use an explicit join entity with two `@one()` navigations instead.

## Data API Builder (DAB)

Some query limitations are imposed by Data API Builder.
See [Data known limitations](./data/index.md#known-limitations).

- Collection queries return only one page unless the client pages through them.
The default page size is 100 records and the maximum page size is 100,000 records.
Use `.first(n)` with `.executePaginated()` and `.after(endCursor)` for lists that can exceed one page.

## Relationships

- Rayfin auto-generates foreign key columns when you define `@one()` or `@many()` navigation decorators.
Define foreign key fields only when you need them in application code.
- When you do define a foreign key field, it must follow the `{property}_id` naming convention.
Custom key names (`foreignKey`, `targetKey`) are not supported on relationship decorators.
- `@one()` and `@many()` accept `{ optional?, unique? }` options only.

## Auth

- The session change callback is `onSessionChange`.
`onAuthStateChange` does not exist on the Rayfin auth client.
- Session objects are opaque.
Gate UI logic on `isAuthenticated` or the presence of a `user` property.
- After enabling or disabling auth in `rayfin.yml`, restart the backend to expose the updated endpoints.

## Data

- `@entity()` does not accept composite field constraints; define constraints on individual fields via field decortor options.
- Prefer `@anonymous()` and `@authenticated()` shorthands over `@role('anonymous', ...)` and `@role('authenticated', ...)`.

## Database and Schema Apply

- Run `npx rayfin up` and wait for services to be created before running `npx rayfin up db apply`.
- If you see `unsupported UUID` errors, another service may be running on the default port with a different database dialect.
- Enabling `data: enabled: true` in `rayfin.yml` requires `dialect: mssql` (or `postgresql`).
- Omitting `dialect` causes a 400 error at deploy time: "Dialect is required when Data module is enabled."
- `@text()` without `max` generates `NVARCHAR(MAX)` columns on MSSQL.
- Rayfin's metadata provider may fail to build a GraphQL schema from these columns, resulting in "Internal server error" at runtime after an otherwise successful deploy.
- Use `@text({ max: N })` on all string fields to avoid this.
