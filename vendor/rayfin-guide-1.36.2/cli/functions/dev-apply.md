---
sidebar_position: 2
---

# dev functions apply

Start the local Rayfin functions runtime against your active deployment, with automatic recompilation when a `build:watch` script is configured, a live typegen watcher, and debugger support.
This is the command you run while developing and debugging functions.

```bash
npx rayfin dev functions apply [--port <port>] [--inspect-port <port>] [--no-debug] [--no-emit-env]
```

## Prerequisites

- **Functions must be enabled** — run [`npx rayfin functions init`](./init.md) first so `services.functions.enabled` is set in `rayfin.yml`.
- **Node.js ≥ 20** and **Azure Functions Core Tools** must be installed. The command verifies these and, with your consent, installs Core Tools if missing.
- **An active deployment** — run `npx rayfin up` at least once so a remote endpoint and publishable key exist to resolve against.

## Options

| Option                  | Default | Description                                                                   |
| ----------------------- | ------- | ----------------------------------------------------------------------------- |
| `--port <port>`         | `7071`  | Port for the local function host. Auto-shifts to the next free port if taken. |
| `--inspect-port <port>` | `9229`  | Port for the Node inspector (debugger).                                       |
| `--no-debug`            | off     | Disable the inspector / attach support.                                       |
| `--no-emit-env`         | off     | Skip regenerating the framework `.env.local`.                                 |

## What it does

1. Gates on `services.functions.enabled` and checks prerequisites (Node, Core Tools).
2. Resolves the active deployment and publishable key.
3. Writes `rayfin/functions/local.settings.json` (environment, API URL, publishable key, workspace/item ids, inspector flag when debugging).
4. Upserts `RAYFIN_PUBLIC_FUNCTIONS_URL` into `rayfin/.env` and regenerates the framework `.env.local` (unless `--no-emit-env`).
5. Preserves the existing same-origin adapter in bundled Vite templates.
   For recognized older or custom Vite clients, the first run patches `functionsBaseUrl` to read the generated URL only during development.
6. Builds the functions project, runs a one-shot typegen, then starts a visible **typegen watcher** (`[typegen]` prefix) that keeps `src/types.ts` in sync as you edit `function_app.ts`.
7. Starts `func start` alongside the package's `npm run build:watch` compiler watcher when configured, and writes a `.vscode/launch.json` **"Functions: Attach"** configuration for debugging.

Press `Ctrl+C` to stop the host and watchers.
This command does not start the frontend.
Run the Vite frontend separately to invoke local functions through `/.rayfin/api/<name>`, or use `npx rayfin dev` to start both together.
If the local Functions host is unavailable, the Vite adapter returns HTTP 502 instead of invoking deployed function code.

This standalone command does not validate or apply the project's Functions auth setting.
Full `npx rayfin up` and normal `npx rayfin dev` perform that validation when applying project settings.
Run a full `npx rayfin up` to apply [`services.functions.auth.type: application`](../../functions/index.md#application-authentication) to the remote app.
For local token identity, see [Local development](../../functions/connections/index.md#local-development).

## Automatic recompilation

Both `npx rayfin dev functions apply` and `npx rayfin dev` build the functions package once, then run its `build:watch` script alongside the local Functions host if the script is configured.
Both commands use `services.functions.path` from `rayfin.yml` and preserve `services.functions.buildCommand` for the initial build.

To enable automatic recompilation, define a long-running `build:watch` script in the functions package's `package.json`; the TypeScript scaffold uses `"build:watch": "tsc --build --watch"`.
If you use a custom compiler or bundler, set that script to its watch command instead.
Source edits are compiled into `dist`, which the host watches to reload handlers.
The separate typegen watcher keeps `src/types.ts` up to date and does not rewrite the file when the generated types are unchanged.

If `build:watch` is absent, the CLI warns and starts the host without a compiler watcher; run the functions package's build command manually after source edits.
Type generation remains enabled without a compiler watcher.
An invalid watch script or an unreadable package manifest remains an error.
An initial build failure prevents host startup; later compiler diagnostics can be fixed without restarting the session.
If the compiler watcher exits, the session stops rather than serving stale code.

Core Tools owns worker reloads; edits made while it is restarting can occasionally leave a stale handler running.
If the response remains stale after compilation finishes, restart the dev session.

## Debugging

With debugging enabled (default), attach your debugger to the inspector port (`9229` by default) using the generated **"Functions: Attach"** launch configuration in VS Code. If you pass a different `--inspect-port`, the existing configuration's port is updated to match. Pass `--no-debug` to run without the inspector.

## Secrets in local development

Locally there is no deployed secret bag, so `ctx.Secrets.<NAME>` falls back to `process.env`. To provide a secret, add it under `Values` in `rayfin/functions/local.settings.json`; the functions host loads those entries into `process.env`. See [Managing Secrets](../secrets.md#using-secrets-in-local-development).

## Next step

When your functions are working locally, deploy them:

```bash
npx rayfin up            # deploys everything, including functions
# or, to re-run only functions:
npx rayfin up functions deploy
```

See [`up functions deploy`](./deploy.md).
The standalone deployment uploads function code; it does not apply YAML auth settings or migrate the remote Functions auth mode.
