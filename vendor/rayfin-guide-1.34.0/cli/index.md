---
sidebar_position: 40
---

# CLI

Use the Rayfin CLI to scaffold projects, run local infrastructure, and apply schema changes.

## Get started

For installation instructions,
see [CLI Installation](./installation.md).

### Typical workflow

```bash
npm create @microsoft/rayfin@latest my-app   # 1. Create a project from a template
cd my-app
npx rayfin up                                 # 2. Start backend services
npm run dev                                   # 3. Run the frontend dev server
```

> **Existing or empty projects:** Use `npx rayfin init` instead of `npm create` to add Rayfin to a project that already has source code or an empty directory.
> The init command walks you through enabling services, choosing a database dialect, and configuring static hosting without scaffolding a new template.

For the full walkthrough, see the [CLI Quickstart](./quickstart.md) or the [Build and deploy tutorial](../getting-started/create-app-with-cli.md).

## Command reference

### Project scaffolding

| Command | Description |
| --- | --- |
| `npm install --save-dev @microsoft/rayfin-cli` | Install the Rayfin CLI as a dev dependency. Not needed if you scaffolded with `npm create @microsoft/rayfin@latest`. |
| `npm create @microsoft/rayfin <name>` | Scaffold a new project from a template. See [Project templates](./templates.md) for choosing a built-in template, scaffolding from a git URL, registering your own template sources, and authoring templates. |
| `npx rayfin init [directory]` | Initialize a new Rayfin project interactively. Prompts for project name, services (Auth, Data), and auth methods. Creates the `rayfin/` directory with starter files. |
| `npx rayfin init ai-files install` | Install or refresh the [agent context files](./ai-files.md) (`AGENTS.md`, `.mcp.json`, `.agents/skills/rayfin/SKILL.md`) so coding agents know how to work with your project. Idempotent; auto-runs as part of the scaffold pipeline. |
| `npx rayfin init ai-files status` | Print the current state of each agent file. Add `--json` for machine-readable output. |

> **Reconfiguring an existing project:** Running `npx rayfin init` in a project that already has a `rayfin/rayfin.yml` re-runs the interactive prompts and regenerates the configuration.
> Use this to enable or disable services, switch the database dialect, or toggle static hosting without editing `rayfin.yml` by hand.
> The CLI preserves your data model files under `rayfin/data/` during reconfiguration.

### Deployment

| Command | Description |
| --- | --- |
| `npx rayfin login` | Sign in with Entra ID for remote Fabric operations. The CLI stores auth state under `~/.rayfin/` and uses the OS keychain for token storage when available. Use `-t, --tenant <id>` to provide your Tenant ID for Fabric sign-in. Add `--select` to always show the MSAL account picker, ignoring any cached account. Pass `--encryption-fallback-enabled` only when login fails with a keychain error to allow plaintext token storage on systems without OS credential storage, such as some Linux distros, dev containers, and Codespaces. |
| `npx rayfin login --service-principal` | Sign in as a service principal using client credentials. Requires `--client-id <id>`, `--client-secret <secret>`, and `-t, --tenant <id>`. Credentials are persisted so subsequent commands authenticate automatically. |
| `npx rayfin login status` | Show the current sign-in status (account and tenant). |
| `npx rayfin logout` | Sign out and clear cached auth state. |
| `npx rayfin up` | Deploy the project to Microsoft Fabric. If you are not signed in, the CLI launches an interactive login flow. Use `-t, --tenant <id>` when your account spans multiple tenants, `-w, --workspace <name>` for a Fabric workspace display name, `-n, --dry-run` to preview without API calls, and `-v, --verbose` for detailed output. Pass `--encryption-fallback-enabled` only when login fails with a keychain error to allow plaintext token storage on systems without OS credential storage, such as some Linux distros, dev containers, and Codespaces. Use `--exclude-services staticHosting` to skip static content build/package/deploy while leaving runtime settings untouched — useful during local development when Vite serves the frontend. Applies runtime settings, database configuration, and static content when enabled. |
| `npx rayfin up status` | Display the status of the Fabric deployment (add `--json` for machine-readable output). |
| `npx rayfin up db apply` | Generate and apply DAB configuration to the remote Rayfin item. Add `--force` to allow changes that may cause data loss. |
| `npx rayfin up secrets apply` | Read secrets from `rayfin/.env` file (prefixed with `RAYFIN_SECRET_`) and securely apply them to the remote Rayfin item workload. Validates that secrets are persisted. Use `--env-file <path>` to specify a custom .env file location. |
| `npx rayfin up staticapp deploy` | Build, package, and deploy static content to the remote Rayfin item. Add `--skip-build` to deploy existing build output without rebuilding. |

## Update the CLI

To get the latest version of the Rayfin CLI and its dependencies:

```bash
npm update --save
npm install
```

Verify the installed version:

```bash
npx rayfin --version
```

## Telemetry

The Rayfin CLI collects anonymous usage data to help improve the product.
On the first run, the CLI displays a notice explaining what is collected and how to opt out.

No personal data, parameter values, or file contents are collected.
Only command names, execution status, execution duration, and environment metadata (OS, Node.js version) are recorded.

To disable telemetry, set the following environment variable:

```bash
export RAYFIN_TELEMETRY_OPTOUT=1
```
