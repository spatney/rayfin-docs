---
sidebar_position: 1
---

# Writing functions

Functions are declared with the `UserDataFunctions` class from `@microsoft/fabric-user-data-functions` and registered with `udf.func()`.

## Registering a function

Create a single `UserDataFunctions` instance and register each function against it:

```ts
import { UserDataFunctions } from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.func(
  "greet",
  (firstName: string, lastName: string): string => {
    return `Hello ${firstName} ${lastName}!`;
  },
  [],
);
```

`udf.func()` takes three arguments:

| Argument      | Description                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | The function name. Becomes the invocation route and the key in your generated schema.                                                        |
| `fn`          | The handler. Its parameter and return types are read by [typegen](./typegen.md).                                                             |
| `connections` | Optional array of connection bindings. Pass `[]` — audience-scoped connections are declared in the context annotation instead. |

The handler's typed parameters and return type are extracted into `types.ts` so the frontend can call the function type-safely.
`Promise<T>` return types are unwrapped to `T` in the generated schema.

## Accessing data and request context

To read your data, tokens, or logging from inside a function, declare a `RayfinContext` parameter.
Pass your app schema as the first generic (`RayfinContext<AppSchema>`) — the same schema you use with `RayfinClient<AppSchema>` — for a fully typed data client.
A second, optional generic declares the external audiences the function may use; see [Connecting to external resources](./connections/index.md).

```ts
import {
  UserDataFunctions,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

type AppSchema = {
  Entry: { id: string; message: string; createdAt: string };
};

const udf = new UserDataFunctions();

udf.func(
  "getEntries",
  async (
    ctx: RayfinContext<AppSchema>,
  ): Promise<{ id: string; message: string }[]> => {
    console.log("getEntries invoked");
    const data = ctx.getDataClient();
    return await data.Entry.select(["id", "message", "createdAt"]).execute();
  },
  [],
);
```

### `RayfinContext` API

| Member                | Description                                                                                                                                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.getDataClient()` | Returns the Rayfin DB entity data client using the invocation's Rayfin token and the caller's identity and database permissions. Query with `.select([...]).where(...).execute()`, as with `client.data.<Entity>` on the frontend. Typed when a schema generic is supplied; otherwise untyped. |
| `ctx.Secrets`         | Secret values keyed by the names declared in `rayfin.yml`, each typed `string`. Reading an undeclared name is a compile error. See [Secrets](./secrets.md).                                                                      |
| `ctx.Tokens`          | Resource access tokens keyed by audience, each typed `string`. Narrowed to the declared audiences; deployed Functions use the app identity. See [Connecting to external resources](./connections/index.md), including local development. |
| `ctx.baseUrl`         | The Rayfin endpoint URL (readonly).                                                                                                                                                                                           |
| `ctx.accessToken`     | The invocation's Rayfin token, used for caller-scoped Rayfin DB access (readonly). Not an external resource token from `ctx.Tokens`.                                                                                          |
| `ctx.publishableKey`  | The Rayfin publishable key (readonly).                                                                                                                                                                                        |

`ctx.getSecret(name)` and `ctx.getToken(audienceType)` are the deprecated predecessors of `ctx.Secrets` and `ctx.Tokens`. They still work, but are flagged by `@typescript-eslint/no-deprecated`.

Use `console.log(...)` / `console.error(...)` for logging.

> **Import `RayfinContext` from `@microsoft/fabric-user-data-functions`** — not from `@microsoft/rayfin-functions`.

## Mixing parameters and context

A handler can take normal input parameters alongside a `RayfinContext`:

```ts
udf.func(
  "addEntry",
  async (message: string, ctx: RayfinContext<AppSchema>): Promise<void> => {
    console.log("addEntry invoked");
    const data = ctx.getDataClient();
    await data.Entry.create({ message });
  },
  [],
);
```

`RayfinContext` is injected by the runtime, so typegen strips it from the generated input type — only `message: string` appears in the schema for `addEntry`.

## Connecting to external resources

To call external Azure or Fabric resources (SQL, Storage, the Fabric REST API, and more) from inside a function, declare the audience in the `RayfinContext` annotation and read the token from `ctx.Tokens`:

```ts
import { AudienceType } from "@microsoft/fabric-user-data-functions";

udf.func(
  "accessStorage",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Storage>,
  ): Promise<void> => {
    const token = ctx.Tokens.Storage;
    // Use `token` with the resource's SDK or REST API.
  },
  [],
);
```

The annotation is the declaration — listing the audience is what registers the connection binding, so nothing goes in the third argument.
See [Application authentication](./index.md#application-authentication) for configuration and identities, and [Connecting to external resources](./connections/index.md) for supported audiences and per-resource guides.

## Importing data entities

Share entity types between your data models and functions with TypeScript project references:

```ts
import type { Entry } from "../../data/Entry.js";
```

- Use `import type` — entity classes are only needed for their type shape, not their runtime value. A non-type import would pull the decorator runtime into the functions bundle.
- The `../../data/` path resolves because `tsconfig.json` sets `"references": [{ "path": ".." }]`.
- Always use the `.js` extension on relative imports for correct ESM resolution.

## Rules

- Always register functions with `udf.func(name, handler, [])` — do not export bare functions.
- Use `RayfinContext<AppSchema>` for type-safe data access. Bare `RayfinContext` still works but gives no type safety on `getDataClient()`.
- Declare external audiences in the context annotation (`RayfinContext<AppSchema, AudienceType.X>`) and read them with `ctx.Tokens.X` — an audience you did not declare is a compile error.
- A function must return a value or `void`. Throwing an error surfaces to the caller as an invocation failure carrying the error message.
- Use `import type` for data entity imports; never a runtime `import`.
