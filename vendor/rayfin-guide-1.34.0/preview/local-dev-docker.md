# Local development with Docker

> **Preview content** — this page is not published in the public docs.
> To enable Docker-based local development, set `RAYFIN_FEATURE_FLAGS=docker-local-dev`.

## Overview

The `rayfin dev` command provides a Docker Compose–based local development environment.
It launches containers for enabled services, runs health checks, and auto-applies the database configuration.

Docker and Docker Compose must be installed and running before using this command.

## Starting the environment

```bash
npx rayfin dev
```

This command:

- Validates that Docker and Docker Compose are available.
- Generates `rayfin/.temp/docker-compose.yml` from your project configuration.
- Allocates ports for each service.
- Starts containers for enabled services (WebService, database, and optional storage).
- Runs health checks and waits for all services to be healthy.

Wait for the `All services healthy` message before continuing.

## Stopping and resetting

| Flag | Behavior |
|------|----------|
| `--stop` | Stop running containers without removing them |
| `--down` | Stop and remove containers |
| `--purge` | Stop, remove containers, and delete volumes (full reset) |

```bash
npx rayfin dev --stop
npx rayfin dev --down
npx rayfin dev --purge
```

## Additional options

| Flag | Behavior |
|------|----------|
| `--detach` | Run containers in the background |
| `--pull` | Pull latest images before starting |
| `--verbose` | Show detailed Docker output |
| `--debug` | Enable debug logging |

## Subcommands

### `rayfin dev db apply`

Generate and apply DAB configuration to the local development server.

```bash
npx rayfin dev db apply
npx rayfin dev db apply --force
```

Run this after making changes to entities in `rayfin/data/`.
Use `--force` to regenerate configuration even if no changes are detected.

### `rayfin dev storage apply`

Generate and apply storage configuration to the local development server.

```bash
npx rayfin dev storage apply
```

### `rayfin dev status`

Display the status of the local development environment.

```bash
npx rayfin dev status
```

Shows container health, port assignments, and service readiness.

### `rayfin dev watch`

Watch `./rayfin/data` or `./rayfin/storage` and auto-apply configuration changes.

```bash
npx rayfin dev watch
```

## Configuration

The `rayfin/rayfin.yml` file controls which services run in the local environment.
Changes to `rayfin.yml` require restarting the environment:

```bash
npx rayfin dev --down
npx rayfin dev
```

## Troubleshooting

- **Docker not running** — ensure Docker Desktop or the Docker daemon is started.
- **`rayfin dev db apply` fails** — make sure services are healthy first (`npx rayfin dev status`).
- **Stale services** — stop stale containers with `npx rayfin dev --down`, then restart.
- **`unsupported UUID` errors** — stop stale services with `npx rayfin dev --down`.
- **Port conflicts** — use `npx rayfin dev --purge` for a full reset.

## Enabling this feature

Set the feature flag in your environment:

```bash
export RAYFIN_FEATURE_FLAGS=docker-local-dev
```

Or combine with other flags:

```bash
export RAYFIN_FEATURE_FLAGS=docker-local-dev,storage
```
