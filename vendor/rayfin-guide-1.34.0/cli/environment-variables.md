# Environment variables

This page is the single reference for every environment variable that Rayfin tooling reads or writes.
Variables are grouped by purpose and lifecycle.

## Frontend-visible variables (`RAYFIN_PUBLIC_*`)

These variables live in `rayfin/.env` and are the **only** variables exposed to frontend builds.
The `rayfin env` command (or the auto-emit built into `rayfin up`) maps them to framework-specific names in `.env.local`.

| Variable | Description | Populated by |
| --- | --- | --- |
| `RAYFIN_PUBLIC_API_URL` | Rayfin backend URL (`http://localhost:5168` for local dev). | `rayfin up` |
| `RAYFIN_PUBLIC_PUBLISHABLE_KEY` | Public key for Rayfin SDK initialization. | `rayfin up` |
| `RAYFIN_PUBLIC_ITEM_ID` | Fabric AppBackend item ID. Used for Fabric brokered auth. | `rayfin up` |
| `RAYFIN_PUBLIC_WORKSPACE_ID` | Fabric workspace ID. Used for Fabric brokered auth. | `rayfin up` |
| `RAYFIN_PUBLIC_TENANT_ID` | Entra ID tenant for workspace disambiguation. | `rayfin up` |
| `RAYFIN_PUBLIC_PORTAL_URL` | Fabric Portal base URL (for example, `https://app.fabric.microsoft.com/`). | `rayfin up` |
| `RAYFIN_PUBLIC_SERVICE_MODE` | `rayfin` (real backend) or `mock` (local testing). | User-set in `rayfin/.env` |
| `RAYFIN_PUBLIC_FRONTEND_PORT` | Stable per-project frontend dev-server port. Assigned once and reused so the dev server pins a deterministic origin the deployed backend can allow-list. | `rayfin dev` / `rayfin up` |

### Framework mapping

`rayfin env --framework <fw>` maps each `RAYFIN_PUBLIC_*` variable to a framework-specific name:

| Source (`rayfin/.env`) | Vite (`.env.local`) | Next.js (`.env.local`) | Plain (`.env.local`) |
| --- | --- | --- | --- |
| `RAYFIN_PUBLIC_API_URL` | `VITE_RAYFIN_API_URL` | `NEXT_PUBLIC_RAYFIN_API_URL` | `API_URL` |
| `RAYFIN_PUBLIC_PUBLISHABLE_KEY` | `VITE_RAYFIN_PUBLISHABLE_KEY` | `NEXT_PUBLIC_RAYFIN_PUBLISHABLE_KEY` | `PUBLISHABLE_KEY` |
| `RAYFIN_PUBLIC_ITEM_ID` | `VITE_FABRIC_ITEM_ID` | `NEXT_PUBLIC_FABRIC_ITEM_ID` | `ITEM_ID` |
| `RAYFIN_PUBLIC_WORKSPACE_ID` | `VITE_FABRIC_WORKSPACE_ID` | `NEXT_PUBLIC_FABRIC_WORKSPACE_ID` | `WORKSPACE_ID` |
| `RAYFIN_PUBLIC_TENANT_ID` | `VITE_FABRIC_TENANT_ID` | `NEXT_PUBLIC_FABRIC_TENANT_ID` | `TENANT_ID` |
| `RAYFIN_PUBLIC_PORTAL_URL` | `VITE_FABRIC_PORTAL_URL` | `NEXT_PUBLIC_FABRIC_PORTAL_URL` | `PORTAL_URL` |
| `RAYFIN_PUBLIC_SERVICE_MODE` | `VITE_SERVICE_MODE` | `NEXT_PUBLIC_SERVICE_MODE` | `SERVICE_MODE` |
| `RAYFIN_PUBLIC_FRONTEND_PORT` | `VITE_PORT` | `PORT` | `FRONTEND_PORT` |

Custom `RAYFIN_PUBLIC_*` variables you add follow a generic pattern: `RAYFIN_PUBLIC_FOO` becomes `VITE_RAYFIN_FOO` (Vite), `NEXT_PUBLIC_RAYFIN_FOO` (Next.js), or `FOO` (plain).

`RAYFIN_PUBLIC_FRONTEND_PORT` maps to the port variable each dev server reads (`VITE_PORT` for Vite, `PORT` for Next.js).
The sample `vite.config.ts` files pin the server to it with `strictPort`, so if the assigned port is already taken the dev server fails fast instead of silently drifting to another port.
To run on a different port, set `RAYFIN_PUBLIC_FRONTEND_PORT` in `rayfin/.env` (then re-run `rayfin env`); `rayfin up` registers whatever value is assigned in the deployed redirect allow-list.

## Tooling overrides

These variables configure CLI and extension behavior.
They are not exposed to the frontend (no `PUBLIC_` infix).
Set them in `rayfin/.env` or as shell environment variables.

| Variable | Description | Default |
| --- | --- | --- |
| `RAYFIN_FABRIC_API_URL` | Fabric REST API base URL the CLI calls. For canonical Fabric hosts (`*.fabric.microsoft.com`) accepts a bare origin (e.g. `https://api.fabric.microsoft.com`) or an `<origin>/v1` URL — extra path segments are stripped to maintain back-compat. For non-Fabric hosts (proxies, custom envs) accepts an origin plus path prefix (e.g. `https://my-proxy.example.com/cli-proxy/fabric/<id>`); the path prefix is preserved verbatim and `/v1` is appended only when the resolved path does not already end in `/v1`. Independent — set on its own, with `RAYFIN_FABRIC_PORTAL_URL`, or with the full authentication group. | `https://api.fabric.microsoft.com/v1` |
| `RAYFIN_FABRIC_PORTAL_URL` | Fabric portal base URL used for deep links and `RAYFIN_PUBLIC_PORTAL_URL`. Independent — set on its own, with `RAYFIN_FABRIC_API_URL`, or with the full authentication group. | `https://app.fabric.microsoft.com/` |
| `RAYFIN_ENV_FILE` | Path to an alternate `.env` file. Equivalent to `--env-file`. | `rayfin/.env` |

When set on their own, the two Fabric endpoint variables apply only to the current process and are **not** persisted.
Subsequent CLI invocations need the same shell or `rayfin/.env` value to keep using the override.

Resolution precedence per variable: shell env var > value in `rayfin/.env` > persisted `environmentConfig` in `~/.rayfin/auth.json` > built-in default.

### Routing through a credential proxy

`RAYFIN_FABRIC_API_URL` accepts a non-Fabric origin with a path prefix on top, which lets you route the CLI's REST calls through a host that mounts the Fabric API under a sub-path (for example, a credential proxy that handles auth on the user's behalf).

```sh
export RAYFIN_FABRIC_API_URL="https://my-proxy.example.com/cli-proxy/fabric/<conn_id>"
```

For non-Fabric hosts, the CLI strips a trailing slash and appends `/v1` only when the resolved path does not already end in `/v1`, then composes the full request URL by appending `/workspaces/...` (and similar) to it.
With the example above, a workspaces lookup goes to `https://my-proxy.example.com/cli-proxy/fabric/<conn_id>/v1/workspaces/...`.

For canonical Fabric hosts (`*.fabric.microsoft.com`) the behavior is different: only the origin is honored and the path is replaced with `/v1`. This preserves the historical normalization for shapes like `https://api.fabric.microsoft.com/v1/workspaces/<id>` (which gets truncated back to `<origin>/v1` rather than producing a double-pathed result).

The portal URL is **not** auto-derived from a non-`*.fabric.microsoft.com` host, so when you target a proxy you typically also want to set `RAYFIN_FABRIC_PORTAL_URL` to the portal you want deep links and `RAYFIN_PUBLIC_PORTAL_URL` to point at — usually production:

```sh
export RAYFIN_FABRIC_PORTAL_URL="https://app.fabric.microsoft.com/"
```

If your proxy also fronts the portal, point it there instead.

> **Security: bearer token forwarding.** When `RAYFIN_FABRIC_API_URL` points at a non-`*.fabric.microsoft.com` host, the CLI sends the Fabric `Bearer <token>` it acquired (whether for the production scope or a custom `RAYFIN_FABRIC_SCOPE`) to that host on every REST call. Only set this to a host you trust to handle those tokens responsibly — typically a first-party credential proxy you operate. There is currently no startup warning or trusted-host allowlist; that is a known follow-up.
>
> **Known limitation: long-running operations.** Operations that return a `202` with a `Location` header are a known limitation in proxy mode. The CLI follows the absolute URL in `Location`, which usually points back at the upstream Fabric host and bypasses your proxy. End-to-end proxy support for these polled operations needs the proxy to rewrite `Location` headers (or the CLI to grow a host-rewrite pass on the polling target). Track the follow-up before relying on proxy mode for long-running ops.

## Runtime port variables

Written to `rayfin/.env` by `rayfin up` during port allocation.
Each port starts at its default value and increments until a free port is found, so multiple projects can run side by side without conflict.
Read via `${VAR:-default}` interpolation in the generated container configuration.

| Variable | Default | Service | Docker profile |
| --- | --- | --- | --- |
| `RAYFIN_WEBSERVICE_HTTP_PORT` | 5168 | Rayfin WebService (HTTP) | always |
| `RAYFIN_WEBSERVICE_HTTPS_PORT` | 7126 | Rayfin WebService (HTTPS) | always |
| `RAYFIN_POSTGRES_PORT` | 5432 | PostgreSQL (admin database) | always |
| `RAYFIN_POSTGRES_DATAAPI_PORT` | 5433 | PostgreSQL (Data API backend) | `data-api-postgresql` |
| `RAYFIN_SQLSERVER_PORT` | 1433 | SQL Server (Data API backend) | `data-api-mssql` |
| `RAYFIN_MAILDEV_SMTP_PORT` | 1025 | MailDev SMTP | `email` |
| `RAYFIN_MAILDEV_WEB_PORT` | 1080 | MailDev web UI | `email` |
| `RAYFIN_AZURITE_BLOB_PORT` | 10000 | Azurite Blob | `storage` |
| `RAYFIN_AZURITE_QUEUE_PORT` | 10001 | Azurite Queue | `storage` |
| `RAYFIN_AZURITE_TABLE_PORT` | 10002 | Azurite Table | `storage` |
| `RAYFIN_FUNCTIONS_PORT` | 7071 | Azure Functions | `function` |
| `RAYFIN_ASPIRE_UI_PORT` | 18888 | Aspire Dashboard UI | `telemetry` |
| `RAYFIN_ASPIRE_OTLP_PORT` | 4317 | Aspire OTLP (gRPC) | `telemetry` |

Port variables are cleaned up from `rayfin/.env` when `rayfin up` shuts down.

## Database passwords

Written to `rayfin/.env` by `rayfin up`.
Passwords are generated on first run and preserved on subsequent runs so existing database volumes keep working.
Never exposed to the frontend.

| Variable | Default | Service |
| --- | --- | --- |
| `RAYFIN_POSTGRES_PASSWORD` | `YourStrong!Passw0rd` | PostgreSQL (admin database) |
| `RAYFIN_SQLSERVER_PASSWORD` | `YourStrong!Passw0rd` | SQL Server |
| `RAYFIN_POSTGRES_DATAAPI_PASSWORD` | `YourStrong!Passw0rd` | PostgreSQL (Data API backend) |

## Service configuration flags

Written to `rayfin/.env` by `rayfin up` based on `rayfin.yml` settings.
Read by the Rayfin WebService container via the ASP.NET Core configuration system.

| Variable | Source (`rayfin.yml`) | Values |
| --- | --- | --- |
| `Auth__Enabled` | `services.auth.enabled` | `true` / `false` |
| `Data__Enabled` | `services.data.enabled` | `true` / `false` |
| `Storage__Enabled` | `services.storage.enabled` | `true` / `false` |

The following signing-key variables are set to dev-mode defaults by `rayfin up` and are not typically edited:

- `Auth__AsymmetricKeys__Provider` — `local-file`
- `Auth__AsymmetricKeys__Algorithm` — `ES256`
- `Auth__AsymmetricKeys__KeySize` — `256`
- `Auth__AsymmetricKeys__LocalFile__AutoGenerateKeys` — `true`

## Shell-only variables

These variables are read from the shell environment and are never written to files.

| Variable | Description |
| --- | --- |
| `RAYFIN_TOKEN` | Pre-acquired Bearer token for headless or non-interactive usage. Bypasses interactive Entra ID login. Prefer `rayfin login --service-principal` which handles token acquisition automatically. Use `RAYFIN_TOKEN` when a token is already available from an external source (for example, `az account get-access-token`). |
| `RAYFIN_WORKSPACE_ID` | Fabric workspace ID for non-interactive setup. Used with `RAYFIN_TOKEN`. |
| `RAYFIN_TENANT_ID` | Entra ID tenant used by `rayfin up` for portal URLs and the `ctid` query parameter. Equivalent to the `-t, --tenant <id>` flag (precedence: flag > env var > signed-in tenant). |
| `RAYFIN_ENCRYPTION_FALLBACK_ENABLED` | Set to `true` to allow plaintext token cache on systems without OS credential storage. Development only. |
| `RAYFIN_FEATURE_FLAGS` | Comma-separated list of experimental feature names to enable (case-insensitive). Recognized values include `storage`, `functions`, and `postgresql`. |
| `RAYFIN_WEBSERVICE_IMAGE_NAME` | **Experimental.** Override the webservice container image used by `rayfin dev` and `docker compose`. Both `rayfin dev` and this variable are experimental and may change. Defaults to `ghcr.io/microsoft/project-rayfin/webservice:cli-<version>`. |
| `RAYFIN_APPINSIGHTS_CONNECTION_STRING` | Override the telemetry endpoint for the CLI and VS Code extension. |

### Recognized `RAYFIN_FEATURE_FLAGS` values

| Flag | Effect |
| --- | --- |
| `storage` | Exposes storage commands (`rayfin dev storage *`) and storage prompts during `rayfin init`. |
| `functions` | Exposes Functions service prompts during `rayfin init`. |
| `postgresql` | Adds PostgreSQL as a selectable dialect during `rayfin init` and `rayfin init` with bundled templates. |

## File locations

| Path | Purpose | Committed |
| --- | --- | --- |
| `rayfin/.env` | All runtime and deployment values. | No (gitignored) |
| `rayfin/.env.example` | Documents expected variables with placeholder values. | Yes |
| `rayfin/.deployments.json` | Multi-deployment registry (item IDs, API URLs, workspace IDs). | No (gitignored) |
| `rayfin/rayfin.yml` | Project configuration, service toggles, frontend framework. | Yes |
| `.env.local` | Framework-specific frontend variables, auto-generated by `rayfin env`. | No (gitignored) |
| `~/.rayfin/auth-state.json` | CLI authentication state (tenant, account hints). | N/A (user home) |
| `~/.rayfin/token-cache.json` | Encrypted token cache (OS-backed encryption). | N/A (user home) |

## Resolution priority

When the same variable is defined in multiple places, the value is resolved in this order (highest priority first):

1. Shell environment variable.
1. `--env-file <path>` CLI flag (or `RAYFIN_ENV_FILE`).
1. `rayfin/.env` file.
1. Default value (hardcoded or from `rayfin.yml` interpolation).
