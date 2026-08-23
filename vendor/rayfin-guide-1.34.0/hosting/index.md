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
| `root` | No | Project root | Root directory of the frontend project, relative to the project root. |
| `buildCommand` | No | — | Shell command to run before packaging (for example, `npm run build`). |
| `indexDocument` | No | — | Default document to serve for directory requests (for example, `index.html`). |

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

## Deploying static content

### Full deployment with `rayfin up`

When you run `rayfin up`, static content is deployed automatically as part of the full stack deployment.
The CLI builds your frontend, packages the output, and uploads it alongside your data and auth configuration.

```bash
rayfin up
```

After deployment, the CLI prints the hosting URL and stores it in `rayfin/.deployments.json` for reference.

#### Skip static deployment during local dev

When iterating locally with `npm run dev` (Vite serves the frontend), pass `--exclude-services staticHosting` to deploy the backend without rebuilding and uploading the static bundle:

```bash
rayfin up --exclude-services staticHosting
```

This skips only the static build/package/deploy phase — runtime settings are still posted, so previously deployed static content keeps serving from Fabric.
The scaffolded `npm run dev` script in every sample and template uses this flag.

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
