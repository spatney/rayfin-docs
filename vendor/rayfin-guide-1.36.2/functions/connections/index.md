---
sidebar_position: 5
---

# Connecting to external resources

Deployed Functions call external Azure and Fabric resources **as the app identity** using application authentication.
You declare the audiences a function needs and consume platform-provided, resource-scoped tokens through `ctx.Tokens`.
See [Application authentication](../index.md#application-authentication) for configuration, resource permissions, and the distinction from caller-scoped Rayfin DB access.

Developer CLI login and authoring-time endpoint discovery are separate from deployed runtime access; verify the deployed app identity's permissions even when a developer can access the resource.

## The pattern

Declare the audiences in the `RayfinContext` annotation, then read the scoped token off `ctx.Tokens`:

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.func(
  "accessStorage",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.Storage>,
  ): Promise<string> => {
    const token: string = ctx.Tokens.Storage;
    // Use `token` with the resource's SDK or REST API.
    return "ok";
  },
  [],
);
```

**The annotation is the declaration.** Listing an audience in `RayfinContext<Schema, Audiences>` is what registers the connection binding — there is nothing to add to the third argument of `udf.func()`.

`ctx.Tokens` is narrowed to exactly the audiences you declared, so an undeclared audience is a compile error rather than a runtime throw:

```ts
async (
  ctx: RayfinContext<AppSchema, AudienceType.Sql | AudienceType.Storage>,
) => {
  const sqlToken: string = ctx.Tokens.Sql; // ok
  const storageToken: string = ctx.Tokens.Storage; // ok
  ctx.Tokens.Fabric; // compile error — not declared
};
```

Values are typed `string`, not `string | undefined`.
Declaring an audience registers its binding, but does not guarantee token availability or resource access.
If the host does not supply a declared token, reading its `ctx.Tokens` property throws.

### The schema argument

`RayfinContext` takes your app schema first — the same one you pass to `RayfinClient<AppSchema>` — so the data client stays typed while you add audiences:

```ts
async (ctx: RayfinContext<AppSchema, AudienceType.Sql>) => {
  const data = ctx.getDataClient(); // typed by AppSchema
  const token = ctx.Tokens.Sql;
};
```

If a function needs audiences but no data access, pass the default schema explicitly:

```ts
async (ctx: RayfinContext<Record<string, any>, AudienceType.Fabric>) => {
  const token = ctx.Tokens.Fabric;
};
```

## The third argument

`udf.func()` still takes a third argument, and it stays `[]`. Audience-scoped connections are declared entirely in the context annotation — there is nothing to add there:

```ts
udf.func(
  "syncWarehouse",
  async (ctx: RayfinContext<AppSchema, AudienceType.Sql>): Promise<void> => {
    const token = ctx.Tokens.Sql;
  },
  [],
);
```

## Supported audiences

`AudienceType` is the source of truth — inventing a member will not compile:

`Sql`, `Storage`, `Fabric`, `AzureAI`, `ADO`.

A Power BI semantic model is **not** reachable this way; use the `fabric-semanticmodel` connector instead.

## How audiences reach the deployment

Type arguments are erased before your function runs, so the audiences have to be recovered at build time. `npx rayfin up` resolves them with the TypeScript compiler and writes the resolved union into the deployment metadata, which is what the worker binds against.

Because the compiler does the resolving, a type alias works:

```ts
type SqlAccess = AudienceType.Sql;

// Resolves to AudienceType.Sql and binds a Sql connection.
async (ctx: RayfinContext<AppSchema, SqlAccess>) => {
  const token = ctx.Tokens.Sql;
};
```

Writing audiences **literally** is still the clearer default, and there is one case where it is required: if the functions project has no `tsconfig.json`, the CLI has no compiler to ask and falls back to reading the annotation's syntax. An alias then resolves to its own name rather than the audience it stands for. The CLI warns when it is in that mode — treat the warning as a real problem, not noise.

The context parameter must also carry an explicit `RayfinContext<...>` annotation. Typegen identifies the context parameter by that annotation; an unannotated parameter is treated as a request-body parameter instead.

## Migrating from `ctx.getToken()`

`ctx.getToken(audienceType)` is **deprecated**. It is flagged by `@typescript-eslint/no-deprecated`, which the scaffolded ESLint config reports as an error.

```ts
// Before
udf.func(
  "queryData",
  async (ctx: RayfinContext): Promise<void> => {
    const token = ctx.getToken(AudienceType.Sql);
  },
  [udf.connection({ audienceType: AudienceType.Sql })],
);

// After
udf.func(
  "queryData",
  async (ctx: RayfinContext<AppSchema, AudienceType.Sql>): Promise<void> => {
    const token = ctx.Tokens.Sql;
  },
  [],
);
```

Move the audience from the third argument into the annotation, then replace the call with the property.

**Both halves are required.** The array keeps working at *runtime* — array audiences are unioned with the annotated ones, so a deployed function still binds the connection. But it no longer carries any type information: `TokenTypes` defaults to `never`, so a handler left as `ctx: RayfinContext<AppSchema>` stops compiling at `ctx.getToken(AudienceType.Sql)` even with `Sql` declared in the array. Add the audience to the annotation first; the array alone is not enough.

## Wrapping the token for Azure SDK clients

Many Azure SDK clients expect a `TokenCredential` rather than a raw token string.
Define a small adapter that returns the token from the context:

```ts
import type { TokenCredential, AccessToken } from "@azure/identity";

class ContextTokenCredential implements TokenCredential {
  constructor(private readonly token: string) {}
  async getToken(): Promise<AccessToken> {
    return { token: this.token, expiresOnTimestamp: Date.now() + 3600_000 };
  }
}
```

Pass `new ContextTokenCredential(ctx.Tokens.X)` wherever an Azure SDK client asks for a credential.
The per-resource guides below use this helper.

## Choose a recipe

Find what you want to connect to. Each row links to a task-oriented walkthrough; the `AudienceType` is the value you put in the context annotation and the key you read off `ctx.Tokens`. A single audience can back more than one use case (for example `Storage` covers both Fabric OneLake and Azure Blob).

| I want to connect to…                            | `AudienceType` | Recipe                                                               |
| ------------------------------------------------ | -------------- | -------------------------------------------------------------------- |
| Fabric Lakehouse / Warehouse / SQL DB / Mirrored | `Sql`          | [Add a Fabric resource](./add-fabric-resource.md#sql-databases)      |
| Azure SQL Database                               | `Sql`          | [Add a Fabric resource](./add-fabric-resource.md#sql-databases)      |
| Fabric OneLake files                             | `Storage`      | [Add a Fabric resource](./add-fabric-resource.md#onelake-files)      |
| Azure Blob / Table / Queue                       | `Storage`      | [Add an Azure resource](./add-azure-resource.md#blob-storage)        |
| Microsoft Fabric REST API                        | `Fabric`       | [Add a Fabric resource](./add-fabric-resource.md#fabric-rest-api)    |
| Azure AI Foundry                                 | `AzureAI`      | [Add Azure AI Foundry](./add-foundry.md)                             |
| Azure DevOps                                     | `ADO`          | [Add Azure DevOps](./add-ado.md)                                     |

To look up a Fabric item's connection coordinates (SQL endpoint or OneLake path), see [Get Fabric info](./get-fabric-info.md).

## Rules

- **Declare generic audiences in the annotation** and read them with `ctx.Tokens.<Audience>`. Prefer literal `AudienceType.X`, and keep a `tsconfig.json` in the functions project so the CLI can resolve anything that isn't.
- **Pass `[]` as the third argument** to `udf.func()`.
- **Use real endpoint URLs** — don't hardcode a guess or read them from `process.env`. For Fabric items, [Get Fabric info](./get-fabric-info.md) shows how to look them up.
- Never acquire tokens manually.
- Grant resource access to the app identity, and keep its tokens server-side; never return them as function results.
- Install resource SDK packages in `rayfin/functions/package.json`, not the project root.

## Local development

`npx rayfin dev` and `npx rayfin dev functions apply` start a local Azure Functions Core Tools host.
External resource tokens use the identity and permissions of the account the builder signs in with in the local Functions host.
Deployed Functions instead use the [application identity](../index.md#application-authentication).
See [`npx rayfin dev functions apply`](../../cli/functions/dev-apply.md).
