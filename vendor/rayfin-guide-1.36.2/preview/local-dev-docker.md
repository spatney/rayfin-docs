# Local development with Docker

> **Preview content** — this page is not published in the public docs.
> To enable Docker-based local development, set `RAYFIN_FEATURE_FLAGS=docker-local-dev`.

## Overview

Bare `rayfin dev` uses the Fabric provider by default.
Pass `--provider docker` to run the managed Rayfin backend and its services through Docker Compose instead.

The provider changes only the backend location.
The frontend and enabled functions always run as local processes during `rayfin dev`.

Docker and Docker Compose must be installed and running before using this command.

## Starting the environment

```bash
npx rayfin dev --provider docker
```

This command:

- Validates that Docker and Docker Compose are available.
- Generates `rayfin/.temp/docker-compose.yml` from your project configuration.
- Allocates ports for each service.
- Starts containers for enabled services (WebService and database).
- Runs health checks and waits for all services to be healthy.
- Applies the project's declared data configuration to the local backend.
- Starts the frontend with `npm run dev:frontend` when that script exists, falling back to `npm run dev` for existing projects.
- Resolves that script from `services.staticHosting.path` when the frontend lives in a nested package, otherwise from the project root.
- Builds and starts the configured local Functions host when `services.functions.enabled` is `true`.

The command remains attached to the frontend and Functions processes.
Press `Ctrl+C` to stop the session and tear down the provider-owned containers.

## Local functions and debugger

When functions are enabled, `rayfin dev --provider docker` reserves the nearest free Functions port starting at `7071` and starts Azure Functions Core Tools.
It writes the selected URL to `RAYFIN_PUBLIC_FUNCTIONS_URL` in `rayfin/.env` and regenerates the framework `.env.local` file.
When functions are disabled, it removes a stale Functions URL instead.

Bundled Vite templates route local function calls through the same-origin `/.rayfin` path.
The Vite adapter forwards only function calls to the selected local host; data, auth, and storage continue to target the Docker backend directly.
An unavailable local Functions host returns HTTP 502 without falling back to deployed function code.

The command also:

- Merges local backend settings into the configured functions package's `local.settings.json`.
- Reserves a Node inspector port starting at `9229`.
- Adds `Functions: Attach` to the root `.vscode/launch.json` after the Functions host is ready. If the entry already exists and the inspector moved to another port, only its `port` is updated.
- Patches recognized existing `src/services/rayfinClient.ts` and `src/services/bootstrap.ts` files to pass `VITE_RAYFIN_FUNCTIONS_URL` directly only during Vite development.

If `.vscode/launch.json` contains JSON with comments, Rayfin leaves it unchanged to avoid losing those comments and asks you to add the attach configuration manually.
Use `--no-emit-env` to leave a hand-managed `.env.local` file unchanged.

## Stopping and resetting

| Flag | Behavior |
|------|----------|
| `--stop` | Stop running containers without removing them |
| `--down` | Stop and remove containers |
| `--provider docker --purge` | Confirm deletion of provider-owned Docker volumes when the attached session ends |
| `--down --purge` | Confirm immediate container and volume deletion without starting a session |
| `--export-env` | Print the retained Docker provider environment in `.env` format |

```bash
npx rayfin dev --stop
npx rayfin dev --down
npx rayfin dev --down --purge
npx rayfin dev --export-env
npx rayfin dev --provider docker --purge
```

The retained `--stop`, `--down`, and `--export-env` maintenance actions operate only on Docker state.
They do not start a workflow session or contact Fabric.
Purge always requires interactive confirmation or global `--yes` in automation.
It cannot be combined with `--stop` or `--export-env`.

## Additional options

| Flag | Behavior |
|------|----------|
| `--provider docker` | Select the Docker backend instead of the default Fabric backend |
| `--skip-db-apply` | Skip automatic data configuration apply |
| `--no-emit-env` | Leave the existing framework `.env.local` file unchanged |
| `--verbose` | Show detailed diagnostic output |

## Subcommands

### `rayfin dev db apply`

Generate and apply DAB configuration to the local development server.

```bash
npx rayfin dev db apply
npx rayfin dev db apply --force
```

Run this after making changes to entities in `rayfin/data/`.
Use `--force` to regenerate configuration even if no changes are detected.

### `rayfin dev status`

Display the status of the local development environment.

```bash
npx rayfin dev status
```

Shows container health, port assignments, and service readiness.

### `rayfin dev watch`

Watch `./rayfin/data` and auto-apply configuration changes.

```bash
npx rayfin dev watch
```

## Configuration

The `rayfin/rayfin.yml` file controls which services run in the local environment.
Changes to `rayfin.yml` require restarting the environment:

```bash
npx rayfin dev --down
npx rayfin dev --provider docker
```

## Troubleshooting

- **Docker not running** — ensure Docker Desktop or the Docker daemon is started.
- **`rayfin dev db apply` fails** — make sure services are healthy first (`npx rayfin dev status`).
- **Stale services** — stop stale containers with `npx rayfin dev --down`, then restart.
- **`unsupported UUID` errors** — stop stale services with `npx rayfin dev --down`.
- **Port conflicts** — stop the process using the reported port; Rayfin automatically slides the frontend, Functions, and inspector ports within bounded ranges.
- **Functions host missing** — install Azure Functions Core Tools by running `npx rayfin dev functions apply`, then retry.

## Enabling this feature

Set the feature flag in your environment:

```bash
export RAYFIN_FEATURE_FLAGS=docker-local-dev
```

This feature flag gates only Docker provider selection and Docker maintenance commands.
Bare `rayfin dev` is available without preview flags and uses Fabric.
