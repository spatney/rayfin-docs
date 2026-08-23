---
sidebar_position: 50
---

# Managing Secrets

The Rayfin CLI provides secure secret management for your remote deployments.
Secrets are encrypted and stored securely in your Rayfin item workload.

## Overview

Use the `rayfin up secrets apply` command to manage application secrets for your remote deployment.
Secrets are read from your `.env` file, securely transmitted to your workload, encrypted, and validated.

## Setting up secrets

### 1. Define secrets in `.env`

Create a `rayfin/.env` file with secrets prefixed using `RAYFIN_SECRET_`:

```bash
# rayfin/.env
RAYFIN_SECRET_API_KEY=sk-prod-abc123xyz789
RAYFIN_SECRET_DATABASE_PASSWORD=secure-db-pass-123
RAYFIN_SECRET_AUTH_TOKEN=token-abcdefg-hijklmn
RAYFIN_SECRET_OPENAI_KEY=sk-openai-your-key-here
```

> **Secret naming:** Secret names must follow the `RAYFIN_SECRET_` prefix convention.
> The part after the prefix becomes your secret name.
> For example, `RAYFIN_SECRET_API_KEY` creates a secret named `API_KEY`.

### 2. Deploy your item

Before managing secrets, deploy your project to Microsoft Fabric:

```bash
npx rayfin up
```

This creates your Rayfin item and sets up the workload endpoint.

### 3. Apply secrets

Apply your secrets to the remote workload:

```bash
npx rayfin up secrets apply
```

The CLI will:
1. Read your `rayfin/.env` file
2. Extract all `RAYFIN_SECRET_*` variables
3. Securely send each secret to your workload
4. Encrypt and persist the secrets
5. Validate that all secrets were successfully saved

### 4. Verify secrets

After running the apply command, you'll see output confirming each secret:

```text
🔐 Acquiring authentication token...
✓ Token acquired
📤 Sending 4 secret(s) to workload...
✓ Secrets sent to workload (4 persisted)
✅ Validating secrets persisted to workload...
✓ All secrets validated

✨ Secrets applied successfully (4/4)
  ✓ API_KEY
  ✓ DATABASE_PASSWORD
  ✓ AUTH_TOKEN
  ✓ OPENAI_KEY
```

## Advanced usage

### Custom .env file location

If your secrets are in a non-standard location, use the `--env-file` option:

```bash
npx rayfin up secrets apply --env-file ./config/secrets.env
```

### JSON output

For automation or scripting, use `--json` for machine-readable output:

```bash
npx rayfin up secrets apply --json
```

Output example:

```json
{
  "status": "success",
  "message": "All secrets applied and validated",
  "secretsCount": 4,
  "persisted": 4,
  "validated": true,
  "secrets": [
    {
      "name": "API_KEY",
      "id": "secret-123",
      "createdAt": "2026-04-17T10:30:00Z"
    }
  ]
}
```

### Verbose logging

Enable detailed logging for debugging:

```bash
npx rayfin up secrets apply --verbose
```

### Non-interactive mode

Use `-y` or `--yes` to skip confirmation prompts:

```bash
npx rayfin up secrets apply -y
```

## Secret handling and security

### Encryption

Secrets are transmitted over HTTPS with encrypted payloads.
The workload endpoint encrypts and persists secrets securely.
Secrets are never logged or displayed after being sent to the workload.

### Best practices

1. **Use `.env` files for local development only** – Never commit `.env` files to version control.
   Add `.env` to your `.gitignore`:

   ```bash
   echo "rayfin/.env" >> .gitignore
   ```

2. **Use environment variables for CI/CD** – In automated environments, set `RAYFIN_SECRET_*` variables directly:

   ```bash
   export RAYFIN_SECRET_API_KEY=prod-key-from-vault
   npx rayfin up secrets apply
   ```

3. **Rotate secrets regularly** – Re-run `rayfin up secrets apply` after updating secret values in your `.env` file.

4. **Separate development and production secrets** – Use different `.env` files or environment variables for each environment.

## Troubleshooting

### No secrets found

If you see "No secrets found in .env file", verify:

- Your `.env` file exists at `rayfin/.env`
- Variables are prefixed with `RAYFIN_SECRET_`
- The file is readable by the CLI process

### Authentication failed

If you see "Failed to acquire authentication token":

- Run `npx rayfin login` to sign in
- Check that you have valid Entra ID credentials
- On containers or restricted environments, use `--encryption-fallback-enabled` or set `RAYFIN_ENCRYPTION_FALLBACK_ENABLED=true`

### Validation inconclusive

If some secrets fail validation:

- Check your network connection to Fabric
- Verify the workload endpoint is running and healthy
- Run `npx rayfin up status` to confirm deployment health
- Re-run `npx rayfin up secrets apply` to retry

### Permission denied

If you see permission errors:

- Ensure you're authenticated with an account that has access to the Fabric workspace
- Verify you have the correct workspace selected
- Run `npx rayfin login --select` to choose a different account/tenant

## See also

- [CLI quickstart](./quickstart.md)
- [Environment configuration](./env-interpolation.md)
