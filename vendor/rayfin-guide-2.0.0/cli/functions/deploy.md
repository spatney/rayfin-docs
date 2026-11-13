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

This standalone command uploads function code; it does not apply changes to `rayfin.yml` runtime settings. After changing `services.functions.auth.type` or other auth/service settings, run a full `npx rayfin up` to sync them to the remote item before testing the deployed functions. A Functions-only deploy cannot migrate the remote Functions auth mode.
If you need to skip the static build/deploy, use `npx rayfin up --exclude-services staticHosting`; it still applies runtime settings.
See [Application authentication](../../functions/index.md#application-authentication).

## Prerequisites

Run `npx rayfin up` at least once first to create the remote item and apply its initial runtime settings. This command deploys to an existing remote item, so a remote endpoint must already exist. If there is no active deployment, run a full `npx rayfin up`. For subsequent function-code-only changes, `up functions deploy` does not require another full `up`.

## Options

| Option          | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `-v, --verbose` | Print detailed build and deploy output.                        |
| `--skip-build`  | Deploy the already-built output without rebuilding first.      |
| `--json`        | Emit machine-readable JSON instead of human-readable progress. |

## What it does

1. Builds and packages the functions project (unless `--skip-build`).
2. Deploys the package to the remote Rayfin item resolved from your active deployment.

## Troubleshooting

### `404` on deploy

A `404` from the deploy endpoint usually means Functions are not enabled on the **remote** item, not that the endpoint is unavailable.
The workload hides every Functions route behind the deployed project's `services.functions.enabled` setting, and this command uploads code without applying project settings.
If you enabled Functions (for example by running `npx rayfin functions init`) after your last full deployment, run `npx rayfin up` once to sync `rayfin.yml`, then retry.

## Related

- [`functions init`](./init.md) — scaffold and enable functions.
- [`dev functions apply`](./dev-apply.md) — run and debug functions locally before deploying.
- [Managing Secrets](../secrets.md) — push secrets that deployed functions read via `ctx.Secrets`.
