---
sidebar_position: 1
---

# functions init

Scaffold a Rayfin functions project under `rayfin/functions/`, enable the functions service, install dependencies, build, and generate the initial types.

```bash
npx rayfin functions init [directory] [--force]
```

## Prerequisites

Run this from a directory that already contains a `rayfin/` project (i.e. you have already run `npx rayfin init`). If `rayfin/` is missing, the command errors and asks you to initialize the app first.

## Arguments and options

| Name          | Description                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `[directory]` | Project directory to initialize in. Defaults to the current directory (`.`).                         |
| `--force`     | Overwrite an existing `rayfin/functions/` scaffold. Without it, existing function code is preserved. |

## What it does

1. **Scaffolds** `rayfin/functions/` with a starter function app, `host.json`, `tsconfig.json`, `package.json`, and `local.settings.json`.
2. **Enables the scaffolded service** in `rayfin.yml` by setting `services.functions.enabled: true`, `services.functions.auth.type: application`, and `services.functions.buildCommand: 'npm run build'`.
3. **Installs dependencies** for the functions project.
4. **Builds** the project.
5. **Generates types** — runs a one-shot typegen to produce `rayfin/functions/src/types.ts` (the `AppFunctionsSchema`).
6. **Installs AI agent files** so assistants understand the functions surface.

Enabled Functions require explicit application authentication.
For existing apps, see [Application authentication](../../functions/index.md#application-authentication) for the configuration and full-deployment requirement.

## Runtime version

Fresh and forced scaffolds pin `@microsoft/fabric-user-data-functions` to the exact version of the running Rayfin CLI, matching connector scaffolding.
This also applies when `rayfin init` scaffolds the Functions service.

The running CLI version may differ from the SDK version already installed in your app.
Run the CLI release you want the Functions runtime to match.
Re-running without `--force` preserves the existing Functions `package.json`, including any runtime version you selected.

## Scaffolded structure

```text
rayfin/
  functions/
    src/
      function_app.ts   # register UDFs here with udf.func(...)
      types.ts          # generated AppFunctionsSchema — do not hand-edit
    host.json
    local.settings.json
    package.json
    tsconfig.json
```

## Re-running

`functions init` is safe to re-run:

- **Without `--force`** on an existing project, it preserves your `function_app.ts` and only refreshes dependencies, build, and generated types.
- **With `--force`**, it overwrites the scaffold (a warning is shown before your files are replaced).

Re-running without `--force` does not rewrite the existing Functions auth setting.
Set `services.functions.auth.type: application` explicitly in an existing app rather than relying on a re-run to migrate it.

## Next step

Start the local host and typegen watcher:

```bash
npx rayfin dev functions apply
```

See [`dev functions apply`](./dev-apply.md).
