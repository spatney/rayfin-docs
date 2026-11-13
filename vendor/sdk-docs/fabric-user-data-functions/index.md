---
symbols:
  - UserDataFunctions
  - UserDataFunctions.func
  - UserDataFunctions.connection
  - RayfinContext
  - RayfinInfo
  - RayfinUser
  - RayfinContext.user
  - RayfinContext.Tokens
  - RayfinContext.Secrets
  - RayfinContext.getDataClient
  - AudienceType
  - CustomAudience
  - Connection
  - AnyConnection
  - AudiencesOf
  - GenericConnectionOptions
  - RayfinSecretRegistry
  - RegisteredSecretNames
  - UserDataFunctionError
  - UDFExceptionCodes
---

# @microsoft/fabric-user-data-functions

[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)

Server-side authoring surface and Azure Functions worker extension for Microsoft Fabric User Data Functions.
This package is how you _write_ a function; invoking one from app code is the separate `@microsoft/rayfin-functions` client.

Scaffold the project with the CLI rather than installing by hand:

```bash
npx rayfin functions init
```

That pins the worker to the exact version of the CLI that generated the project, prerelease suffix included, so the runtime your handlers compile against matches the one that will host them. If you are adding the dependency to an existing project, pin the same exact version rather than a floating dist-tag:

```bash
npm install @microsoft/fabric-user-data-functions@<your-rayfin-cli-version>
```

## API summary

| Export                                             | Purpose                                                                                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UserDataFunctions`                                | Registry for a functions project. Create one per `function_app.ts`.                                                                                        |
| `UserDataFunctions.func(...)`                      | Register a function: `(name, handler, connections?)`.                                                                                                      |
| `UserDataFunctions.connection(...)`                | Build an audience-scoped connection declaration from `{ audienceType }`, or `{ audience }` for a [custom audience](#custom-audiences).                     |
| `RayfinContext<TSchema, TokenTypes, TSecretNames>` | Injected request context: typed data client, caller subject id, audience-scoped access tokens, secrets.                                                    |
| `AudienceType`                                     | Supported resource audiences: `Sql`, `Storage`, `Fabric`, `AzureAI`, and `ADO`.                                                                            |
| `CustomAudience`                                   | Any other resource, as an application ID (GUID) or `https://` / `api://` URI. See [Custom audiences](#custom-audiences).                                   |
| `Connection<TokenType>`                            | A declared connection. `TokenType` is a phantom parameter carrying the declared audience.                                                                  |
| `AnyConnection`                                    | `Connection<ConnectionAudience>` — any connection regardless of audience.                                                                                  |
| `AudiencesOf<TConnections>`                        | The union of audiences declared by an array of connections.                                                                                                |
| `GenericConnectionOptions<TokenType>`              | `{ audienceType }` — the options accepted by `connection()`.                                                                                               |
| `RayfinSecretRegistry`                             | Empty interface the CLI augments to type `ctx.Secrets`. **Do not implement by hand.**                                                                      |
| `RegisteredSecretNames`                            | `keyof RayfinSecretRegistry` — the secret names known to this compilation.                                                                                 |
| `UserDataFunctionError`                            | Base error for invocation failures, carrying `errorCode` and `properties`. Subclasses cover internal, invalid-input, missing-input, and user-thrown cases. |
| `UDFExceptionCodes`                                | The `errorCode` constants: `InvalidInput`, `MissingInput`, `UserThrown`, `InternalError`.                                                                  |

## Registering a function

```ts
import { UserDataFunctions } from '@microsoft/fabric-user-data-functions';

const udf = new UserDataFunctions();

udf.func(
  'greet',
  (firstName: string, lastName: string): string =>
    `Hello ${firstName} ${lastName}!`,
  []
);
```

`func()` takes the function name, the handler, and an optional `connections` array — pass `[]`; audience-scoped connections are declared in the context annotation instead.
The handler's parameter and return types are read at build time and written into the generated `types.ts`, which is what gives the frontend a typed `client.functions.greet.invoke(...)`. `Promise<T>` return types are unwrapped to `T`.

## `RayfinContext`

Declare a parameter of type `RayfinContext` to reach data, tokens, and secrets. Rayfin supplies this parameter automatically; callers provide only the remaining inputs.

```ts
import {
  AudienceType,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';

udf.func(
  'syncTodos',
  async (ctx: RayfinContext<AppSchema, AudienceType.Sql>): Promise<void> => {
    const data = ctx.getDataClient(); // typed by AppSchema
    const token: string = ctx.Tokens.Sql;
    const apiKey: string = ctx.Secrets.THIRD_PARTY_API_KEY;
  },
  []
);
```

| Type parameter | Default                 | Meaning                                                                                           |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `TSchema`      | `Record<string, any>`   | The app data schema. Types `getDataClient()` using the SDK's `dataService<TSchema>()` capability. |
| `TokenTypes`   | `never`                 | Union of audiences this function declares. Keys `Tokens`.                                         |
| `TSecretNames` | `RegisteredSecretNames` | Secret names available to this function. Keys `Secrets`.                                          |

Other members: `baseUrl`, `accessToken`, `publishableKey` (all readonly).

Use `ctx.user.id` when a function must stamp an owner field that data policies compare to `claims.sub`.
It is the same caller subject id exposed by the frontend session as `session.user.id`, and no email, role, access token, or provider identity is exposed.

```ts
await ctx.getDataClient().Todo.create({
  title: 'Buy food',
  owner_id: ctx.user.id,
});
```

Do not decode `ctx.accessToken` yourself for ownership.

### `Tokens`

Declare the audiences your function needs **in the context type**; pass `[]` for the `connections` argument.
`Tokens` is an exact `Readonly<Record<TokenTypes, string>>`, so reading an audience you did not declare is a compile error:

```ts
async (ctx: RayfinContext<AppSchema, AudienceType.Sql>) => {
  ctx.Tokens.AzureAI; // compile error — not declared
  const token: string = ctx.Tokens.Sql;
};
```

Token values are typed `string`. If a token cannot be issued for a declared audience, reading it throws a descriptive error rather than returning `undefined`.

### Custom audiences

To call a resource that is not an `AudienceType` member, declare its application ID (GUID) or resource URI (`https://...` or `api://...`) as a string literal and read the token by the same string:

```ts
async (
  ctx: RayfinContext<AppSchema, AudienceType.Sql | 'api://contoso-api'>
) => {
  const token: string = ctx.Tokens['api://contoso-api'];
};
```

A custom-audience token is issued to the function item's own identity, not on behalf of the caller, so the target resource must trust that identity.
Declare the resource, not a scope: `api://contoso-api`, not `api://contoso-api/.default`.
Wildcards, query strings, fragments, and `http://` URIs are rejected: `npx rayfin up` lists them and stops before deploying anything.
If one reaches the worker anyway, `udf.connection({ audience })` does not throw; the function it is passed to fails each invocation, and the other functions keep working.

Code that inspects `Connection` objects should allow for custom audiences: `isGeneric` is now also `true` for a custom-audience connection, whose `audienceType` is `undefined`.
Read `tokenKey`, which works for either kind, or check `isCustomAudience` before reading `audienceType`.
Apps that declare only `AudienceType` connections are unaffected.

### `Secrets`

Secret names come from `RayfinSecretRegistry`, which `npx rayfin secret set <NAME>` types by regenerating `secrets.generated.ts` under the functions project's `src/` folder (`rayfin/functions/src/` by default) — a module augmentation that nothing needs to import:

```ts
ctx.Secrets.THIRD_PARTY_API_KEY; // string
ctx.Secrets.NOT_DECLARED; // compile error
```

Secrets configured for your app are available through `ctx.Secrets`. During local development, you can also supply secrets through environment variables.

## Deprecated accessors

`ctx.getToken(audienceType)` and `ctx.getSecret(name)` are deprecated in favour of `ctx.Tokens` and `ctx.Secrets`, and are flagged by `@typescript-eslint/no-deprecated`, which the scaffolded ESLint config reports as an error.

Migrating is not only a rename. Audiences declared in the `connections` argument are still honoured at runtime — they are unioned with the annotated ones — but they contribute nothing to the type system. `TokenTypes` defaults to `never`, so `ctx.getToken(AudienceType.Sql)` on a bare `RayfinContext<AppSchema>` no longer compiles even when `Sql` is in the array. Add the audience to the annotation, then switch to `ctx.Tokens.Sql`.

## Guides

See the [Functions guide](/docs/guide/functions/), [writing functions](/docs/guide/functions/writing-functions), [connecting to external resources](/docs/guide/functions/connections/), and [secrets](/docs/guide/functions/secrets) for task-oriented instructions.

## License

Copyright (c) Microsoft Corporation. Licensed under the MIT License.
