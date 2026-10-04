---
sidebar_position: 50
---

# Managing Secrets

Secrets are encrypted values — API keys, connection strings, tokens — that your app needs at runtime but must never ship in client code. They are stored securely on your deployed Rayfin item and read on the server by [functions](./functions/index.md) via `ctx.Secrets`.

Manage secrets with the `npx rayfin secret` command group:

| Command                                   | Description                                          |
| ----------------------------------------- | ---------------------------------------------------- |
| `npx rayfin secret set <name>`            | Set one secret (masked prompt or `--stdin`).         |
| `npx rayfin secret set --env-file <path>` | Bulk-set every `KEY=VALUE` entry from a dotenv file. |
| `npx rayfin secret list`                  | List secret names and timestamps (never values).     |
| `npx rayfin secret delete <name>`         | Delete a secret.                                     |

## Prerequisite: deploy first

Secrets live on the remote Rayfin item, so you must deploy before managing them:

```bash
npx rayfin up
```

Every `secret` command resolves the remote endpoint from your active deployment. If none exists, the CLI stops with:

```text
❌ No remote endpoint configured
   Run 'npx rayfin up' first to deploy your item to Fabric.
```

## Setting a secret

By default, `secret set` prompts for the value with masked input:

```bash
npx rayfin secret set OPENAI_KEY
# ? Enter secret value for "OPENAI_KEY" ********
```

For non-interactive use (CI, scripts), pipe the value in with `--stdin`:

```bash
echo "sk-openai-your-key-here" | npx rayfin secret set OPENAI_KEY --stdin
```

### Recording a description in `rayfin.yml`

Use `--describe` to record a human-readable description alongside the secret's metadata in `rayfin/rayfin.yml` (the value itself is never written to `rayfin.yml`). The flag **must** use the `=` syntax:

```bash
npx rayfin secret set OPENAI_KEY --describe="OpenAI API key for the chat function"
```

Passing `--describe "..."` with a space is rejected — always use `--describe="..."`.

## Bulk-setting from a file

To set many secrets at once, keep them in a dotenv file and point `secret set` at it with `--env-file`:

```bash
# rayfin/.env.secrets
OPENAI_KEY=sk-openai-your-key-here
DATABASE_PASSWORD=secure-db-pass-123
AUTH_TOKEN=token-abcdefg-hijklmn
```

```bash
npx rayfin secret set --env-file rayfin/.env.secrets
```

Every `KEY=VALUE` line becomes a secret named `KEY` — there is **no prefix convention**; the key is used verbatim. Blank lines and `#` comments are ignored, and surrounding single or double quotes are stripped from values. Do not pass a `<name>` together with `--env-file`, and do not combine `--env-file` with `--stdin`.

> **Keep secret files out of version control.** Add your secrets file to `.gitignore` — it is for authoring only, never committed:
>
> ```bash
> echo "rayfin/.env.secrets" >> .gitignore
> ```

## Listing secrets

```bash
npx rayfin secret list
```

Only names and created/updated timestamps are returned — values are never read back:

```text
📋 Secrets (3):

  Name:         OPENAI_KEY
  Created:      4/17/2026, 10:30:00 AM
  Last Updated: 4/17/2026, 10:30:00 AM
```

## Deleting a secret

```bash
npx rayfin secret delete OPENAI_KEY          # prompts for confirmation
npx rayfin secret delete OPENAI_KEY --yes    # skips the prompt (-y)
```

Deleting a secret that does not exist reports a not-found error — run `npx rayfin secret list` to see what is currently stored.

## Reading secrets from functions

Server-side functions read secrets at runtime as typed properties on `ctx.Secrets`, which resolve against the deployed item's secret bag and fall back to `process.env`. Set a secret with `npx rayfin secret set <name>`, then read it by the same name inside your handler:

```ts
import { type RayfinContext } from "@microsoft/fabric-user-data-functions";

udf.func(
  "summarize",
  async (ctx: RayfinContext<AppSchema>, input: { text: string }) => {
    const apiKey = ctx.Secrets.OPENAI_KEY;
    // ... call the API with apiKey
  },
  [],
);
```

The `RayfinContext<AppSchema>` annotation is what makes this type-safe. An unannotated `ctx` is contextually `any`, so `ctx.Secrets.OPENAI_KEY` compiles whether or not the secret is declared — and the annotation is also how typegen recognises the parameter as the injected context rather than a request-body argument.

Setting the secret is what types it: the CLI regenerates `rayfin/functions/src/secrets.generated.ts`, so `ctx.Secrets.OPENAI_KEY` is a `string` and an undeclared name is a compile error. See [Secrets](../functions/secrets.md) for the full model.

## Using secrets in local development

When you run functions locally with [`npx rayfin dev functions apply`](./functions/dev-apply.md), there is no deployed secret bag, so `ctx.Secrets.<NAME>` falls back to `process.env`. To make a secret available locally, add it under `Values` in `rayfin/functions/local.settings.json` — the Azure Functions host loads those entries into `process.env`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "OPENAI_KEY": "sk-local-dev-key"
  }
}
```

`npx rayfin dev functions apply` **merges** its own CLI-managed values into `local.settings.json` and preserves any keys you add, so your local secrets survive re-runs. Keep `local.settings.json` out of version control — it is for local development only.

## Automation and JSON output

Every `secret` command accepts the global `--json` flag for machine-readable output and `--verbose` for detailed logging:

```bash
npx rayfin secret list --json
npx rayfin secret set OPENAI_KEY --stdin --json < key.txt
```

## Security notes

- Secrets are transmitted over HTTPS and encrypted at rest on the workload. They are never logged or displayed after being sent.
- `npx rayfin secret list` returns only names and timestamps — never values.
- Use separate secret values per environment, and rotate them by re-running `npx rayfin secret set` with the new value.

## Troubleshooting

### No remote endpoint configured

Run `npx rayfin up` first to deploy your item, then retry. Secrets cannot be managed before an initial deployment exists.

### Authentication failed

If acquiring a token fails:

- Run `npx rayfin login` to sign in and confirm you have valid Entra ID credentials.
- On containers or restricted environments without an OS keychain, pass `--encryption-fallback-enabled` to allow plaintext token storage.

### Secret not found on delete

If `secret delete` reports the secret was not found:

- It may already be deleted — run `npx rayfin secret list` to confirm.
- Secret management may not be enabled for the item; verify the deployment with `npx rayfin up status`.

## See also

- [Functions](./functions/index.md) — read secrets from server-side functions with `ctx.Secrets`.
- [CLI quickstart](./quickstart.md)
- [Environment configuration](./env-interpolation.md)
