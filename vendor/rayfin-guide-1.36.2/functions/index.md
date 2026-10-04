---
sidebar_position: 35
---

# Functions

Rayfin functions are server-side user-defined functions (UDFs) that run in the Fabric runtime and are invocable from your frontend through `RayfinClient`.
Write trusted backend logic once, get a type-safe client call on the frontend.

## When to use functions

Reach for a function whenever logic should run on the backend rather than in the browser:

- **Sensitive operations** — code that touches secrets, API keys, or privileged data access.
- **Business logic that must not be tampered with** — anything you would not want a user to inspect or modify in client code.
- **Server-side validation** — enforce rules that a malicious client could otherwise bypass.
- **Aggregation and transformation** — shape or combine data before returning it to the client.

If a frontend feature needs trusted server-side behavior, implement it as a function.

## Getting started

Scaffold the functions project with the CLI:

```bash
npx rayfin functions init
```

This creates `rayfin/functions/`, installs dependencies, and generates the initial `types.ts`.
See [`npx rayfin functions init`](../cli/functions/init.md) for the full command reference.

## Application authentication

Enabled Functions require explicit application authentication in `rayfin/rayfin.yml`:

```yaml
services:
  functions:
    enabled: true
    auth:
      type: application
    buildCommand: npm run build
```

New Functions scaffolds set `auth.type: application`.
For an existing app, set it explicitly; loading the configuration does not add a default or migrate an older auth mode.
Disabled Functions may omit `auth`, but any supplied `auth` must include `type: application`.
No feature flag is needed.

Full `npx rayfin up` and normal `npx rayfin dev` validate this setting before applying project settings to either the Fabric or Docker backend.
Run a full `npx rayfin up` to apply the YAML auth mode to an existing remote app.
Standalone `npx rayfin dev functions apply`, `npx rayfin up functions deploy`, and `npx rayfin up staticapp deploy` do not perform this project-settings validation or change the remote Functions auth mode.

Deployed Functions use two separate authentication paths:

| Access path | Credential | Identity and permissions |
| --- | --- | --- |
| External connections through `ctx.Tokens.*` | Platform-provided resource token | Application identity and its permissions on the external resource |
| Rayfin DB through `ctx.getDataClient()` | The invocation's Rayfin token | The caller's identity and permissions on the Rayfin DB |

For current Fabric apps, the app identity is the owner of the Fabric app item.
External connections therefore use the item owner's permissions, not those of whichever app user invokes the function.
Grant that identity the permissions required by each external resource and API your functions call.
Declaring an audience or deploying Functions does not grant those permissions.
App sign-in and authorization to invoke a function remain separate from the app identity's external resource access.
Rayfin DB access always uses the Rayfin token and preserves the caller's identity and database permissions.
Setting `services.functions.auth.type: application` does not switch Rayfin DB access to the application identity.
See [Connecting to external resources](./connections/index.md) for audience declarations, permissions, and local development.

## Project structure

After `npx rayfin functions init`, the functions project lives at `rayfin/functions/`:

```text
rayfin/
├── data/                 ← entity classes (shared via TS project references)
└── functions/
    ├── src/
    │   ├── function_app.ts   ← register your functions here
    │   └── types.ts          ← auto-generated schema (do not edit)
    ├── package.json
    ├── tsconfig.json         ← references: [{ "path": ".." }]
    ├── host.json
    └── local.settings.json   ← local-only settings (git-ignored)
```

`tsconfig.json` uses `composite: true` with a project reference to `rayfin/`, so functions can `import type` from your data entities without duplicating definitions.

## Your first function

The scaffold seeds `src/function_app.ts` with a simple example:

```ts
import { UserDataFunctions } from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.func(
  "helloWorld",
  (firstName: string, lastName: string): string => {
    console.log(`helloWorld invoked for ${firstName} ${lastName}`);
    return `Hello ${firstName} ${lastName}!`;
  },
  [],
);
```

The handler's parameter and return types are read by typegen and written into `types.ts` so the frontend can call `client.functions.helloWorld.invoke({ firstName, lastName })` with full type safety.

## The development loop

For local development, prefer `npx rayfin dev`; it starts the frontend and functions together automatically.
To iterate on functions **without** starting the frontend static app, run only the function host:

```bash
npx rayfin dev functions apply
```

This starts a local function host, keeps a typegen watcher running, and publishes its URL for local frontend routing.
Bundled Vite apps use the same-origin `/.rayfin/api/<name>` route when you run the frontend separately.
See [`npx rayfin dev functions apply`](../cli/functions/dev-apply.md) for details.

## Next steps

- [Writing functions](./writing-functions.md) — the `udf.func()` API, `RayfinContext`, and data access.
- [Type generation](./typegen.md) — how `types.ts` is generated and kept in sync.
- [Connecting to external resources](./connections/index.md) — app-identity access to SQL, Storage, the Fabric REST API, and more.
- [Secrets](./secrets.md) — reading secrets from inside a function.
- [Invoking functions from the frontend](./invoking-from-frontend.md) — calling functions with `RayfinClient`.
