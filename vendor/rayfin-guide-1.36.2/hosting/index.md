---
sidebar_position: 50
---

# Static Content Hosting

Rayfin can build, package, and serve your frontend application as static content alongside your backend APIs.
When static hosting is enabled, the CLI deploys your built assets to the Rayfin host, which serves them at a public URL.

## How it works

1. Rayfin runs your configured build command (for example, `npm run build`).
1. The CLI validates that the output folder exists and contains files.
1. All files are packaged into a compressed ZIP archive (100 MB maximum).
1. The archive is uploaded to the Rayfin host, which extracts and serves the content.
1. The host returns a public hosting URL where your site is accessible.

## Configuration

Add a `staticHosting` section under `services` in your `rayfin.yml` file:

```yaml
services:
  staticHosting:
    enabled: true
    folder: dist
    buildCommand: npm run build
    indexDocument: index.html
```

### Configuration options

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `enabled` | Yes | — | Set to `true` to enable static hosting. |
| `folder` | Yes | — | Output folder containing built static files, relative to `root`. |
| `path` | No | Project root | Frontend package directory, relative to the Rayfin project root. |
| `root` | No | `path` or project root | Build directory, relative to `path` when configured, otherwise the project root. |
| `buildCommand` | No | — | Shell command to run before packaging (for example, `npm run build`). |
| `indexDocument` | No | — | Default document to serve for directory requests (for example, `index.html`). |

### Declared package versions

Every `rayfin up` records which packages produced the deployment, under `packageVersions` in the runtime settings it uploads:

| Key | When it is sent |
| --- | --- |
| `@microsoft/rayfin-cli` | Always, set to the running CLI's version. |
| `@microsoft/rayfin-auth` | When your frontend package has the auth SDK installed, set to the installed version. |

You do not author this.
Run `rayfin up --dry-run` to see exactly which versions a deploy would declare, without deploying.

Once your tenant enforces static-hosting access control, a CLI too old to record its version cannot deploy a static-hosted app, and the deployment is rejected with instructions to upgrade:

```bash
npm install -g @microsoft/rayfin-cli@latest
```

### Example with a separate frontend directory

If your frontend lives in a subdirectory:

```yaml
services:
  staticHosting:
    enabled: true
    root: frontend
    folder: dist
    buildCommand: npm run build
    indexDocument: index.html
```

This resolves the output path to `<project-root>/frontend/dist`.

For a workspace package, use `path: packages/frontend` instead of `root: frontend`.
The CLI detects the framework and refreshes `.env.local` in that frontend directory before building.
When both `path` and `root` are configured, the build and environment directory is `<project-root>/<path>/<root>`.
The `path`, `root`, and `folder` values must be relative and cannot traverse outside their containing directory.

## Deploying static content

### Full deployment with `rayfin up`

When you run `rayfin up`, static content is deployed automatically as part of the full stack deployment.
The CLI builds your frontend, packages the output, and uploads it alongside your data and auth configuration.

```bash
rayfin up
```

After deployment, the CLI prints the hosting URL and stores it in `rayfin/.deployments.json` for reference.

Use `rayfin up --dry-run --workspace-id <workspace-id>` to validate local inputs and display the resolved target without deploying.
Preview requires the frontend package and build directory to exist.
It does not run the build, so a missing output folder is allowed when `buildCommand` is configured.
Without a build command, preview requires existing, nonempty output.

#### Skip static deployment during local dev

Use `rayfin dev` for the normal inner loop.
It provisions or reuses the backend and starts Vite locally without publishing static content:

```bash
rayfin dev
```

Existing scripts and automation can still run `up` while skipping the static build/package/deploy phase:

```bash
rayfin up --exclude-services staticHosting
```

This skips only the static build/package/deploy phase — runtime settings are still posted, so previously deployed static content keeps serving from Fabric.
Rayfin's bundled samples and templates use `rayfin dev` instead.

### Standalone static deployment

Use the `staticapp deploy` subcommand to redeploy only your static content without rerunning the full `rayfin up` flow:

```bash
rayfin up staticapp deploy
```

This is useful when you have only changed frontend code and want a faster iteration cycle.

#### Skip the build step

If you have already built your frontend and want to deploy the existing output:

```bash
rayfin up staticapp deploy --skip-build
```

#### Verbose output

Enable detailed logging with the `-v, --verbose` flag:

```bash
rayfin up staticapp deploy -v
```

## Redirect URI registration

When static hosting is enabled, Rayfin automatically registers the hosting URL's bare origin in `allowedRedirectUris` during deployment.
This is required for the postMessage-based Fabric brokered auth handoff, even when interactive auth is disabled.

For example, if your hosting URL is `https://bold-river-a3f1bc9d02-westus2.webapp.example.com`, the deploy tool adds:

```yaml
services:
  auth:
    allowedRedirectUris:
      - http://localhost:5173
      - https://bold-river-a3f1bc9d02-westus2.webapp.example.com
```

You do not need to configure this manually.
The deploy tool updates the configuration and pushes it to the backend during deployment.

## Deployment limits

- The compressed ZIP archive must not exceed **100 MB**.
- The CLI uses maximum compression to minimize upload size.
- If your build output exceeds the limit, consider excluding large assets or using the storage service for binary files.

## Complete example

A full `rayfin.yml` with static hosting, auth, and data enabled:

```yaml
id: my-app
name: my-app
version: 1.0.0
services:
  auth:
    enabled: true
    allowedRedirectUris:
      - http://localhost:5173
  data:
    enabled: true
    dialect: postgresql
  staticHosting:
    enabled: true
    folder: dist
    buildCommand: npm run build
    indexDocument: index.html
```

## Troubleshooting

### Static folder not found

If the CLI reports that the static folder does not exist, verify that:

- The `folder` path in `rayfin.yml` is correct and relative to `root` (or the project root if `root` is not set).
- Your build command has run successfully and produced output in the expected directory.

### Empty static folder

An empty output folder usually means the build command did not produce output.
Run the build command manually to check for errors:

```bash
npm run build
```

### Deployment too large

If the ZIP exceeds 100 MB:

- Review your build output for unnecessary files (source maps, unoptimized images).
- Configure your bundler to exclude development artifacts from the production build.
- Move large binary assets to Rayfin storage instead of bundling them as static content.

### No remote endpoint configured

The `rayfin up staticapp deploy` command requires an existing remote deployment.
Run `rayfin up` first to provision the remote endpoint, then use `staticapp deploy` for subsequent updates.
