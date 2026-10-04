---
sidebar_position: 3
---

# Secrets

Functions read secret values as typed properties on `ctx.Secrets`, part of [`RayfinContext`](./writing-functions.md#rayfincontext-api).

```ts
import {
  UserDataFunctions,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.func(
  "readApiKey",
  async (ctx: RayfinContext<AppSchema>): Promise<string> => {
    return ctx.Secrets.THIRD_PARTY_API_KEY;
  },
  [],
);
```

There is nothing to add to the function's declaration and nothing to add to your data schema — declaring the secret with the CLI is what types it.

## How the names are typed

`npx rayfin secret set <NAME>` records the name in `rayfin.yml`, and the CLI regenerates `rayfin/functions/src/secrets.generated.ts`. That file augments the SDK's `RayfinSecretRegistry` interface, which is what narrows `ctx.Secrets`:

```ts
ctx.Secrets.THIRD_PARTY_API_KEY; // string
ctx.Secrets.NOT_DECLARED; // compile error
```

- Values are typed `string`, not `string | undefined` — the name was declared, so the value is modelled as present. Reading a declared secret that was not supplied throws a diagnosable error rather than silently yielding `undefined`.
- Nothing imports `secrets.generated.ts`; it only has to be part of the compilation. **Never hand-edit it** — the CLI overwrites it, and the typegen watcher deliberately ignores it so regenerating doesn't loop.
- Deleting a secret narrows the type, so stale references stop compiling instead of failing at invocation.

## How resolution works

`ctx.Secrets.<NAME>` resolves in this order:

1. The host-provided secret bag delivered with the invocation.
2. `process.env[NAME]` as a fallback.

## Setting secrets

Manage project secrets with the CLI:

```bash
npx rayfin secret set THIRD_PARTY_API_KEY
```

These are stored against your deployment and delivered to the function at invocation time.
See [Managing secrets](../cli/secrets.md) for the full `npx rayfin secret` command group.

## Secrets in local development

The host-provided secret bag is only present for deployed invocations.
When you debug locally with `npx rayfin dev functions apply`, add the same key under `Values` in `rayfin/functions/local.settings.json` so it flows into `process.env` and is picked up by the fallback:

```jsonc
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "THIRD_PARTY_API_KEY": "local-development-value",
  },
}
```

`local.settings.json` is git-ignored, so these values stay on your machine.
See [Secrets in local development](../cli/secrets.md#using-secrets-in-local-development) for more.

## The deprecated `ctx.getSecret()`

`ctx.getSecret(name)` returns `string | undefined` and is **deprecated** — it is flagged by `@typescript-eslint/no-deprecated`, which the scaffolded ESLint config reports as an error.

```ts
// Before
const apiKey = ctx.getSecret("THIRD_PARTY_API_KEY");
if (!apiKey) {
  throw new Error("Missing THIRD_PARTY_API_KEY secret.");
}

// After
const apiKey = ctx.Secrets.THIRD_PARTY_API_KEY;
```

It remains valid for a value deliberately **not** modelled in `rayfin.yml` — a host-injected environment variable, for example. Suppress the lint at that one call site rather than project-wide.

## Best practices

- Declare every secret with `npx rayfin secret set <NAME>` and read it from `ctx.Secrets` — never hard-code a secret name string.
- Use the `process.env` fallback only for local debugging — do not make it your primary production secret source.
