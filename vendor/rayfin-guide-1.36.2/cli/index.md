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
npm run dev                                   # 2. Start the complete development session
```

The scaffolded `dev` script runs `rayfin dev`.
It provisions or reuses a Fabric backend, applies the declared services and schema, and starts the frontend and enabled Functions locally.

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

### Development

| Command | Description |
| --- | --- |
| `npx rayfin dev` | Start the development session. Uses the Fabric backend provider by default, provisions a missing AppBackend, applies declared state, and starts frontend and Functions code locally. |
| `npx rayfin dev --provider docker` | Run the managed backend through the preview Docker provider while keeping frontend and Functions code local. |

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
| `npx rayfin up staticapp deploy` | Build, package, and deploy static content to the remote Rayfin item. Add `--skip-build` to deploy existing build output without rebuilding. |

### Functions

Functions are server-side user-defined functions (UDFs) that run in the Fabric runtime and are invocable from your frontend through `RayfinClient`. Use them for logic that must run on the backend — secrets, privileged data access, and server-side validation. See [Functions](./functions/index.md) for the full guide.

| Command | Description |
| --- | --- |
| `npx rayfin functions init [directory]` | Scaffold `rayfin/functions/`, enable the functions service, install dependencies, build, and generate types. See [functions init](./functions/init.md). |
| `npx rayfin dev functions apply` | Run the local function host with an optional compiler watcher, live typegen, and debugger support. See [dev functions apply](./functions/dev-apply.md). |
| `npx rayfin up functions deploy` | Build, package, and deploy functions to the remote Rayfin item. `rayfin up` runs this automatically. See [up functions deploy](./functions/deploy.md). |

### Connectors

Connectors let a Rayfin app read from — and, for some types, write to — Microsoft Fabric data sources. See [Connectors](./connectors/index.md) for the full guide.

| Command | Description |
| --- | --- |
| `npx rayfin connector search [query]` | Discover Fabric sources the signed-in identity can add before you know exact workspace or item IDs. See [connector search](./connectors/search.md). |
| `npx rayfin connector add --type <type> --workspace-id <ws-id> --item-id <item-id>` | Declare a connector in `rayfin.yml` and scaffold `rayfin/connectors/<name>/`. See [connector add](./connectors/add.md). |
| `npx rayfin connector inspect` | Explore a connector's underlying source in read-only mode by listing entity names, sampling one entity, or running a `.sql` / `.dax` query file. See [connector inspect](./connectors/inspect.md). |
| `npx rayfin connector invoke <connector-name> <operation>` | Run a single named operation against a configured connector. See [connector invoke](./connectors/invoke.md). |
| `npx rayfin connector list` | Print the configured connectors. See [Connectors](./connectors/index.md#where-connector-state-lives). |
| `npx rayfin connector remove <name>` | Delete both the `rayfin.yml` entry and the `rayfin/connectors/<name>/` directory. See [Connectors](./connectors/index.md#where-connector-state-lives). |
| `npx rayfin up connector apply [--name <name>]` | Re-apply DAB config only. See [Deploying connectors](./connectors/index.md#deploying-connectors). |

### Secrets

Secrets are encrypted values stored on your deployed Rayfin item and read at runtime — for example by [functions](./functions/index.md) via `ctx.Secrets`. See [Managing Secrets](./secrets.md) for the full guide.

| Command | Description |
| --- | --- |
| `npx rayfin secret set <name>` | Set a single secret on the deployed item with a masked prompt. Use `--stdin` for non-interactive input and `--describe="..."` to record a description in `rayfin.yml`. |
| `npx rayfin secret set --env-file <path>` | Bulk-set every `KEY=VALUE` entry from a dotenv file. |
| `npx rayfin secret list` | List secret names and their created/updated timestamps (values are never returned). |
| `npx rayfin secret delete <name>` | Delete a secret from the deployed item. Add `-y, --yes` to skip the confirmation prompt. |

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

## Diagnostic logs

`npx rayfin up`, workflow-based `npx rayfin dev`, and `npx rayfin dev functions apply` record detailed diagnostics under `~/.rayfin/logs/` even when `--verbose` is absent, including when using `--json` or `--output json`.
After a failure, open the file identified by `Diagnostic log:` to inspect the original invocation without rerunning it.
JSON failures include the same path in the `diagnosticLog` field of the single result object.
`dev` JSON failures also include a `hint` with recovery guidance, including provider/configuration preflight errors and unexpected failures.

Adding `--verbose` also mirrors diagnostic records to stderr while these commands run.
The CLI rejects combining `--verbose` with `--json` or `--output json`; detailed diagnostics are still recorded in the log file without `--verbose`.
Other standalone subcommands and Docker maintenance flags such as `dev --stop` do not record these logs.

Local Functions sessions show function endpoints, the debugger address, application output, and warnings or errors by default.
Recognized host startup and configuration detail, HTTP request metadata, and successful initial build output are kept in diagnostics; use `--verbose` to mirror that detail to the terminal.
When the host restarts after a watched file change, such as `node_modules` updates after an install, the terminal shows a single `Functions host restarted.` line and the debugger address only when it changes.
When the initial build fails, human output includes a bounded tail of compiler output, and JSON errors include it in `buildOutput`.
The tail retains up to 100 complete lines and 64 KiB, with an explicit marker when earlier output is omitted.
Verbose mode does not replay the same compiler output a second time.
Terminal output preserves stack-frame paths and line numbers, while masking credentials and email addresses.
Application lines up to 16 KiB are preserved; oversized lines are replaced with an explicit truncation marker.
Persistent diagnostic logs continue to apply their separate privacy and size limits.
Failed HTTP responses show their status and, when request metadata is available, the method and path without query strings.
Unrecognized output remains visible.
Frontend output is unchanged.
Both `dev` and `dev functions apply` flush their logs after cleanup on Ctrl-C, runtime failure, or normal completion.
Piped runtime and build output is captured with a 1 MiB limit per stream.
Interactive Functions sessions keep standard input attached for keyboard interaction, while stdout and stderr are piped for filtering and diagnostic capture.
Other interactive runtimes that inherit the terminal keep their keyboard and TTY behavior; their console output is not captured, and the log records that limitation alongside lifecycle events.

Logs stay on your machine and are independent of telemetry opt-out.
The log directory is shared across projects on your machine, so the retention limits below apply across all projects using it.
Known credential patterns are redacted, and build output is bounded, but review logs before sharing them because project tools can emit their own content.
Retention is best-effort: logs older than 14 days are pruned, with targets of 20 invocation files and 100 MiB total; each file is limited to 10 MiB.
If `RAYFIN_CONFIG_DIR` is set, logs use its `logs/` subdirectory instead.
An unavailable or full log directory does not change the command result.
