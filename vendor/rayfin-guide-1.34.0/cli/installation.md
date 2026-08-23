---
sidebar_position: 0
---

# CLI Installation

The Rayfin CLI (`@microsoft/rayfin-cli`) scaffolds projects,
runs local infrastructure, and deploys to Microsoft Fabric.
This page covers how to install it and verify it is working.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  (or Docker Engine on Linux) for local development

## Installation

### New project

Scaffold a project from a template.
This installs the CLI automatically as a dev dependency:

```bash
npm create @microsoft/rayfin@latest my-app
cd my-app
```

### Existing project

If you already have a project and want to add Rayfin,
install the CLI as a dev dependency first:

```bash
npm install --save-dev @microsoft/rayfin-cli
```

Then run the interactive setup to create the `rayfin/`
directory with starter configuration files:

```bash
npx rayfin init
```

## Verify the installation

Confirm the CLI is available and check the installed version:

```bash
npx rayfin --version
```

You should see the version number printed to the terminal.

Run `npx rayfin --help` to list all available commands:

```bash
npx rayfin --help
```

## First steps

Start the backend services:

```bash
npx rayfin up
```

This launches the enabled services,
runs health checks, and applies the database configuration.
Wait for the deployment to complete before continuing.

Apply schema changes after updating your data models:

```bash
npx rayfin up db apply
```

Run your frontend dev server in a separate terminal:

```bash
npm run dev
```

## Update the CLI

To get the latest version:

```bash
npm update --save
npm install
```

Verify the update:

```bash
npx rayfin --version
```

## Next steps

- [CLI Quickstart](./quickstart.md) for a full walkthrough
  of creating, developing, and deploying a project.
- [CLI command reference](./index.md) for the complete
  list of commands and options.
- [Build your first Rayfin app](../getting-started/create-app-with-cli.md)
  for a step-by-step tutorial.
