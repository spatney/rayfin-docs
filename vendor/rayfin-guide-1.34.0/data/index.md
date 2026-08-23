---
sidebar_position: 30
---

# Data

Define entities with decorators and Rayfin generates DAB-compliant schema, REST, and GraphQL endpoints.
To get started

- [Define Data Models](./overview.md)
- [Data client for CRUD operations](./graphql.md)
- [Data permissions](./permissions.md)
- [Form validation](./validation.md)

## Known Limitations

- Date comparison queries (gt, lt, gte, lte) do not work when querying a Postgres database: [DAB issue #3094](https://github.com/Azure/data-api-builder/issues/3094)
- Querying for the total count is unsupported: [DAB discussion #2234](https://github.com/Azure/data-api-builder/discussions/2234), [DAB issue #2369](https://github.com/Azure/data-api-builder/issues/2369)
- Paginated querying with before is unsupported: [DAB issue #2238](https://github.com/Azure/data-api-builder/issues/2238)
- Nested entity querying beyond the second level is currently not supported because `GraphQLQueryBuilder.buildFieldSelection()` only supports 2-level nesting (uses `split('.', 2)`).
