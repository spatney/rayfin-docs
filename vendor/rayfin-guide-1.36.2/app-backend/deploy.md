---
sidebar_position: 45
---

# Deploy to Microsoft Fabric

Rayfin deploys your entire application stack to Microsoft Fabric with a single command.
The CLI handles authentication, resource provisioning, database schema application, and static content hosting so you can go from local development to a live URL in minutes.

## Prerequisites

- A Rayfin project with a `rayfin/rayfin.yml` configuration file.
- A Microsoft account with access to a Fabric workspace.

## Sign in

Authenticate with your Microsoft Entra ID account before deploying:

```bash
npx rayfin login
```

The CLI opens a browser window for interactive sign-in.
After authentication, tokens are stored securely in the OS keychain under `~/.rayfin/`.

Check your sign-in status at any time:

```bash
npx rayfin login status
```

To force an account selection prompt when multiple accounts are available:

```bash
npx rayfin login --select
```

### Non-interactive login

Authenticate as a service principal using client credentials when interactive browser login is not available or desired:

```bash
npx rayfin login --service-principal \
  --client-id <app-registration-client-id> \
  --client-secret <secret> \
  --tenant <tenant-id>
```

Credentials are persisted to `~/.rayfin/` so all subsequent commands in the same pipeline job authenticate automatically.
No browser or user interaction is required.

Alternatively, set the `RAYFIN_TOKEN` environment variable with a pre-acquired Bearer token to bypass MSAL entirely.
See [Environment variables](../cli/environment-variables.md#shell-only-variables) for details.

## Deploy with `rayfin up`

Run the following command from your project root:

```bash
npx rayfin up
```

If you are not signed in, the CLI launches an interactive login flow automatically.

### Prepare Fabric capacity

Before creating the Rayfin item, `rayfin up` checks whether the target workspace already has Fabric capacity.
If the workspace reports an assigned capacity, Rayfin uses it without changing or reevaluating the assignment.

On a first interactive deployment without a workspace target or `--capacity-id`, Rayfin asks you to choose:

1. `Use new workspace [Recommended]` runs workspace and capacity readiness.
2. `Select existing workspace` skips capacity readiness and opens the accessible-workspace picker.

Explicit workspace options and recorded deployments continue directly to their existing targeting flow without showing this choice.
Dry-run invocations do not show the choice.
An interactive invocation with `--capacity-id <id>` automatically prepares a new workspace and assigns that capacity without showing the workspace choice.
An untargeted non-interactive invocation automatically prepares a new workspace without prompting.
Pass `--capacity-id <id>` to use a specific capacity for that new workspace.
Pass an existing workspace target to deploy there instead.

When the workspace needs capacity, an interactive deployment asks for confirmation before assigning the selected or trial capacity.
Pass `--yes` to approve a deterministic capacity assignment without the prompt:

```bash
npx rayfin up --yes
```

To select a specific existing capacity, pass its Fabric capacity ID.
This explicitly approves assigning that capacity:

```bash
npx rayfin up --capacity-id <capacity-guid>
```

Do not combine `--capacity-id` with `--workspace`, `--workspace-id`, or `--workspace-uri`.
If multiple premium capacities are available, select one explicitly with `--capacity-id`.
An existing recorded deployment keeps its current workspace capacity and ignores a newly supplied capacity ID.

### Choose a unique Fabric item name

By default, `rayfin up` uses the project ID from `rayfin.yml` as the Fabric item name.
Pass `--item-name` to deploy a template under a different name without editing its configuration:

```bash
npx rayfin up --item-name my-team-todo-app
```

The override changes only the Fabric item display name.
Runtime settings and service configuration continue to come from `rayfin.yml`.
Rayfin records the effective item name and item ID in `rayfin/.deployments.json`, so later deployments continue targeting the same item.

For an agent or CI pipeline, provide explicit workspace targeting and structured output:

```bash
npx rayfin up \
  --item-name my-team-todo-app \
  --workspace-id <workspace-guid> \
  --output json
```

The `--yes` option also approves reuse of an existing same-named item, so use it only when both automatic capacity assignment and item reuse are acceptable.

### What `rayfin up` does

The command performs these steps in order:

1. **Creates a Rayfin item** in your Fabric workspace (or reuses the existing one on subsequent deploys).
1. **Retrieves the publishable key** from the remote service.
1. **Syncs runtime settings** from your `rayfin.yml` to the remote service, including auth configuration and service flags.
1. **Applies the database schema** generated from your TypeScript data model decorators.
1. **Builds and deploys static content** if `staticHosting` is enabled in `rayfin.yml` — runs your build command, packages the output folder into a ZIP, and uploads it.
1. **Persists deployment details** to `rayfin/.deployments.json` and merges `RAYFIN_PUBLIC_*` variables into `rayfin/.env` for subsequent deploys.

After deployment, the CLI prints:

- The **hosting URL** where your app is live.
- A **Fabric portal link** to manage the deployment.
- The **deployment ID** for reference.

### Deployment output

Each deployment is recorded in `rayfin/.deployments.json` (the registry of every workspace you have deployed to from this project), and the corresponding `RAYFIN_PUBLIC_*` variables are merged into `rayfin/.env` so subsequent commands and your frontend pick up the same values.

For frontend frameworks, the CLI refreshes a framework-specific `.env.local` (for example, for Vite) before the static build.
Detection and environment generation use the frontend directory selected by `services.staticHosting.path` and its optional `root`, while the public deployment values come from the project's `rayfin/.env`.
If detection or environment generation fails, the deployment reports a warning with guidance instead of treating it as a successful refresh.

```text title="rayfin/.deployments.json"
{
  "active": "myworkspace",
  "deployments": {
    "myworkspace": {
      "fabricItemId": "7db00cb9-f630-4ecf-8fc9-942e60af5d78",
      "itemName": "my-team-todo-app",
      "fabricApiUrl": "https://...",
      "fabricWorkspaceId": "8b17cf64-3c12-46ac-a572-192732c32641",
      "fabricTenantId": "...",
      "publishableKey": "pk-nua-EHihY2jz71V65YB4",
      "fabricPortalUrl": "https://dxt.fabric.microsoft.com/",
      "hostingUrl": "https://silky-sand-4924b3ad1f-centraluseuap.webapp.rayfingwdev.com",
      "deployedAt": "2026-04-28T01:15:50.514Z"
    }
  }
}
```

The matching `.env.local` (auto-generated by `rayfin env --framework vite`) looks like:

```bash title=".env.local"
VITE_FABRIC_ITEM_ID=7db00cb9-f630-4ecf-8fc9-942e60af5d78
VITE_RAYFIN_API_URL=https://...
VITE_FABRIC_WORKSPACE_ID=8b17cf64-3c12-46ac-a572-192732c32641
VITE_RAYFIN_PUBLISHABLE_KEY=pk-nua-EHihY2jz71V65YB4
VITE_FABRIC_PORTAL_URL=https://dxt.fabric.microsoft.com/
```

| Variable                      | Description                                                   |
| ----------------------------- | ------------------------------------------------------------- |
| `VITE_FABRIC_ITEM_ID`         | The Fabric item ID for this deployment.                       |
| `VITE_RAYFIN_API_URL`         | Full URL to the deployed Rayfin backend API.                  |
| `VITE_FABRIC_WORKSPACE_ID`    | The Fabric workspace ID containing the deployment.            |
| `VITE_RAYFIN_PUBLISHABLE_KEY` | Publishable key used by the Rayfin client for authentication. |
| `VITE_FABRIC_PORTAL_URL`      | URL to the Fabric portal for managing the deployment.         |

### Authentication after deployment

Only **Fabric brokered authentication (Entra SSO)** is supported on deployed applications. Email and password authentication is available during local development but does not work after deploying to Fabric.

Ensure your `rayfin.yml` has Fabric auth enabled before running `rayfin up`:

```yaml
services:
  auth:
    enabled: true
    fabric:
      enabled: true
```

### Preview without deploying

Use `-n, --dry-run` to see what the CLI would do without creating or modifying any resources:

```bash
npx rayfin up -n --workspace-id <workspace-id>
```

Preview validates deterministic local static-hosting inputs before authentication or remote lookup.
The configured frontend `path` and optional build `root` must exist and be directories.
When `buildCommand` is configured, the output `folder` may be missing because the build has not run yet.
Without a build command, the output folder must already exist and contain files.
Static input checks are skipped when static hosting is disabled or excluded.

After local validation, preview uses the same authentication and workspace-selection rules as deployment.
It makes read-only Fabric requests to resolve the current workspace display name and ID, showing both before the planned operations.
With `--json`, these values are available as `plan.workspaceName` and `plan.workspaceId`.
If the workspace cannot be resolved, preview exits nonzero without creating or modifying resources.

Preview does not run builds, provision an item, apply settings or schemas, or update project deployment files.
A successful preview is not a build result or a guarantee that remote deployment operations will succeed.

### Skip specific services

Use `--exclude-services <names>` to skip the build/package/deploy phase for supported services without touching the rest of the deployment.
The runtime settings POST still reflects your `rayfin.yml`, so the backend is never silently reconfigured.
The only currently supported value is `staticHosting`; other names fail with a clear error.

Use `rayfin dev` for the normal local-development workflow; it never publishes the static bundle.
The exclude flag remains useful for existing scripts and automation that intentionally run the deployment workflow while Vite serves the frontend:

```bash
npx rayfin up --exclude-services staticHosting
```

Rayfin's bundled samples and templates use `rayfin dev` for their `npm run dev` script.

## Apply database changes remotely

After updating your data models, push schema changes to the remote database without redeploying the full stack:

```bash
npx rayfin up db apply
```

If the schema change involves potentially destructive operations (dropping columns, renaming tables), the CLI warns you and refuses to proceed.
Use `--force` to override the safety check:

```bash
npx rayfin up db apply --force
```

## Redeploy static content

When you have only changed frontend code, redeploy static content independently for a faster iteration cycle:

```bash
npx rayfin up staticapp deploy
```

This runs your configured `buildCommand`, packages the output, and uploads it to the remote service.

To skip the build step and deploy existing output:

```bash
npx rayfin up staticapp deploy --skip-build
```

## Check deployment status

View the current state of your Fabric deployment:

```bash
npx rayfin up status
```

Add `--json` for machine-readable output:

```bash
npx rayfin up status --json
```

To inspect a specific registered deployment instead of the active one, pass its name to `up`:

```bash
npx rayfin up --env-file staging status
```

If `RAYFIN_WORKSPACE_ID` is also set, the selected deployment must belong to that workspace.

The management endpoint check verifies authenticated access to the deployed Fabric item and retrieves its publishable key.
It does not verify that every application route or function is working; validate those with application-specific requests.

In JSON output, `endpointHealth.scope` is `management` and `endpointHealth.url` identifies the endpoint checked.
`endpointHealth.reachable` records whether an HTTP response arrived, while `httpStatus` and `authenticated` distinguish HTTP success from authentication or authorization failures.
The top-level `authenticated` field indicates that the CLI acquired a token, not that the endpoint accepted it.
`endpointHealth.errorCode` is `null` on success, or a stable code such as `http`, `redirect`, `timeout`, `connection-refused`, or `network`; `error` and `hint` provide human-readable details.
Optional key-retrieval problems appear separately in `endpointHealth.metadata.error`, which is `null` on success or `unexpected-format` for an unsupported response body; the saved deployment key is not changed.

The command exits with `0` when the management request succeeds, `1` when deployment configuration is missing or another command error occurs, or `2` when the check fails, cannot authenticate, or is cancelled.
HTTP errors, timeouts, and connection failures return `2`, even when the server is reachable.
An unexpected metadata format alone does not fail a successful management request.

When static content is deployed, the human-readable output includes its public URL:

```text
Static app:      https://silky-sand-4924b3ad1f-centraluseuap.webapp.rayfingwdev.com
```

The JSON output exposes the same value as `deployment.hostingUrl`:

```json
{
  "deployment": {
    "hostingUrl": "https://silky-sand-4924b3ad1f-centraluseuap.webapp.rayfingwdev.com"
  }
}
```

When no static app URL is recorded, the human-readable output omits the line and `deployment.hostingUrl` is `null` in JSON.

## Sign out

Clear cached credentials when you are done or need to switch accounts:

```bash
npx rayfin logout
```

## Subsequent deployments

After the first deploy, `rayfin/.deployments.json` records the deployment metadata and the matching `RAYFIN_PUBLIC_*` values are merged into `rayfin/.env`. The frontend `.env.local` (generated by `rayfin env --framework vite`) reflects those values (`VITE_FABRIC_ITEM_ID`, `VITE_FABRIC_WORKSPACE_ID`, and the API endpoint).
Running `npx rayfin up` again updates the same deployment rather than creating a new one.

For targeted updates, use the subcommands:

| Command                          | What it updates                                     |
| -------------------------------- | --------------------------------------------------- |
| `npx rayfin up`                  | Everything: settings, database, and static content. |
| `npx rayfin up db apply`         | Database schema only.                               |
| `npx rayfin up staticapp deploy` | Static content only.                                |

## Troubleshooting

### Deployment fails with 401 or 403

Your session may have expired. Run `npx rayfin login` to reauthenticate, then retry `npx rayfin up`.

### Database apply reports destructive changes

The CLI blocks schema changes that could cause data loss. Review the listed operations and use `npx rayfin up db apply --force` only after confirming you accept the data loss.

### Deployment fails with "Dialect is required"

Enabling `data: enabled: true` in `rayfin.yml` without specifying a `dialect` causes a 400 error during `rayfin up`.
Add `dialect: mssql` (or `postgresql` for local dev) under the `data` section:

```yaml
services:
  data:
    enabled: true
    dialect: mssql
```

### Static deploy exceeds size limit

The compressed archive must not exceed 100 MB. Optimize your build output by excluding source maps and large development assets.

### GraphQL returns "Internal server error" after deploy

If `rayfin up` succeeded but the app fails with GraphQL errors at runtime, check for `@text()` fields without `max` in your entity definitions.
These generate `NVARCHAR(MAX)` columns on MSSQL, which can prevent DAB from building its GraphQL schema.
Add explicit `max` constraints (e.g., `@text({ max: 200 })`), then redeploy with `npx rayfin up db apply --force`.
