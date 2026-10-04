---
sidebar_position: 3
---

# up functions deploy

Build, package, and deploy your functions to the remote Rayfin item.

```bash
npx rayfin up functions deploy [-v | --verbose] [--skip-build] [--json]
```

## When to use it

`npx rayfin up` already deploys functions as part of a full deployment. Use `up functions deploy` when you want to run **only** the functions step — for example to retry after a functions deploy failed, or to push a functions-only change without redeploying the rest of the app.

This standalone command uploads function code; it does not validate or apply `services.functions.auth.type` from YAML or migrate the remote Functions auth mode.
After setting `services.functions.auth.type: application` for an existing app, run a full `npx rayfin up` to apply project settings.
See [Application authentication](../../functions/index.md#application-authentication).

## Prerequisites

Run `npx rayfin up` at least once first. This command deploys to an existing remote item, so a remote endpoint must already exist. If there is no active deployment, run a full `npx rayfin up`.

## Options

| Option          | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `-v, --verbose` | Print detailed build and deploy output.                        |
| `--skip-build`  | Deploy the already-built output without rebuilding first.      |
| `--json`        | Emit machine-readable JSON instead of human-readable progress. |

## What it does

1. Builds and packages the functions project (unless `--skip-build`).
2. Deploys the package to the remote Rayfin item resolved from your active deployment.

## Related

- [`functions init`](./init.md) — scaffold and enable functions.
- [`dev functions apply`](./dev-apply.md) — run and debug functions locally before deploying.
- [Managing Secrets](../secrets.md) — push secrets that deployed functions read via `ctx.Secrets`.
