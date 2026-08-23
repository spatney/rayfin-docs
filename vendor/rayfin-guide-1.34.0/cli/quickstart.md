---
sidebar_position: 1
---

# CLI Quickstart

Use these commands to create and manage Rayfin projects.

## Pre-requisites

Install the [prerequisites](../getting-started/index.md#prerequisites) before continuing.

## Create a new project

```bash
npm create @microsoft/rayfin@latest my-app
```

The project name is a **positional argument** — not a flag.
Provide a valid directory name like `my-app`, or use `.` to scaffold into the current directory.

- The CLI prompts for a template and database dialect interactively.
- See [Project templates](./templates.md) for skipping the prompt with `-t, --template`, scaffolding from a git URL, or authoring your own templates.
- Expected result: `✔ Project created`.

## Add Rayfin to an existing project

If you already have a project and want to add Rayfin:

```bash
npm install --save-dev @microsoft/rayfin-cli
npx rayfin init
```

This installs the CLI and runs the interactive setup to create the `rayfin/` directory with starter configuration files.

## Deploy to Fabric

```bash
npx rayfin login
npx rayfin up
```

- Sign in with your Microsoft account when prompted.
- The CLI uses the OS keychain for token storage when available.
- Deploys your project to Microsoft Fabric.
- Use `npx rayfin up status` to check deployment state.
- Expected result: a successful deployment status for your Rayfin item.

For non-interactive environments, use service principal authentication instead:

```bash
npx rayfin login --service-principal --client-id <id> --client-secret <secret> --tenant <tenant-id>
npx rayfin up
```

## Apply database schema changes

```bash
npx rayfin up db apply [--force]
```

- Run after updating decorated entities under `rayfin/data`.
- Ensure `npx rayfin up` has completed successfully before applying.
- Use `--force` to proceed when warned about potential data loss.
- Expected result: `✔ Configuration applied successfully!`.

## Deploy static content

If `staticHosting` is enabled in `rayfin/rayfin.yml`, `npx rayfin up` automatically builds, packages, and deploys your static assets.

When iterating locally with Vite, opt out of the static deploy phase with `npx rayfin up --exclude-services staticHosting`.
This is what the scaffolded `npm run dev` script does so the backend deploys but the local Vite server keeps serving your frontend.

To redeploy static content independently without running the full `rayfin up` flow:

```bash
npx rayfin up staticapp deploy
```

- Runs the configured `buildCommand`, packages the output folder into a ZIP, and uploads it.
- Use `--skip-build` to deploy existing build output without rebuilding.
- Expected result: `Static content deployed` with a hosting URL.

## Troubleshooting

- **Authentication fails (401/403)**: Rerun auth scripts and confirm `NODE_AUTH_TOKEN` is set; verify with `npm view @microsoft/rayfin-cli version`.
- **Database apply fails**: Wait for services to report healthy, then rerun `npx rayfin up db apply`.
