---
sidebar_position: 2
---

# Environment Variable Interpolation

Rayfin supports environment variable interpolation in `rayfin.yml` configuration files using Docker Compose-style syntax.
This allows you to manage environment-specific values (connection strings, API keys, URLs) without hard-coding sensitive data in your configuration.

## Syntax

Rayfin supports two interpolation patterns:

- `${VAR}` - Simple variable substitution (fails if variable is unset or empty).
- `${VAR:-default}` - Substitution with default value if variable is unset or empty.

Following Docker Compose semantics, the `:-` operator treats both undefined and empty string values as requiring the default.

**Examples:**

```bash
# .env file
DEFINED=value
EMPTY=
# UNDEFINED is not set
```

```yaml
# rayfin.yml - Results:
config1: ${DEFINED}             # → "value" (uses variable)
config2: ${EMPTY:-fallback}     # → "fallback" (empty, uses default)
config3: ${UNDEFINED:-fallback} # → "fallback" (unset, uses default)
config4: ${DEFINED:-fallback}   # → "value" (defined, ignores default)
config5: ${EMPTY}               # → Error! (empty without default)
config6: ${UNDEFINED}           # → Error! (unset without default)
```

## Usage

### Basic Substitution

```yaml
# rayfin.yml
services:
  data:
    host: ${DB_HOST}
    port: ${DB_PORT}
```

```bash
# .env file (rayfin/.env)
DB_HOST=localhost
DB_PORT=5432
```

### Default Values

Provide fallback values when environment variables are not set:

```yaml
services:
  data:
    host: ${DB_HOST:-localhost}
    port: ${DB_PORT:-5432}
```

### Partial Interpolation

Combine static text with variables:

```yaml
services:
  auth:
    issuer: https://${AUTH_DOMAIN}/oauth
    connectionString: Server=${DB_HOST};Port=${DB_PORT};Database=${DB_NAME}
```

## .env File Location

By default, Rayfin loads environment variables from `rayfin/.env`.
You can customize this in three ways:

1. **CLI argument** (highest priority):

   ```bash
   rayfin up --env-file /custom.env
   rayfin up --env-file /production.env
   ```

2. **Environment variable**:

   ```bash
   export RAYFIN_ENV_FILE='/staging.env'
   rayfin up
   ```

3. **Default**: `rayfin/.env`

## Environment Priority

When resolving variable values, Rayfin follows this priority:

1. Shell environment variables (if non-empty).
2. Variables from `.env` file (if non-empty).
3. Default values (if specified with `:-` syntax and variable is unset or empty).
4. Error if variable is unset or empty and no default is provided.

## Type Coercion

Rayfin automatically converts interpolated values to appropriate YAML types:

```yaml
# rayfin.yml
services:
  data:
    port: ${DB_PORT}        # Becomes number 5432, not string "5432"
    enabled: ${ENABLED}     # Becomes boolean true, not string "true"
```

```bash
# .env
DB_PORT=5432
ENABLED=true
```

Type coercion only applies when the entire value is a variable reference.
Partial interpolation always produces strings:

```yaml
url: http://localhost:${PORT}  # Results in string "http://localhost:5432"
```

## Example: Todo App Configuration

```yaml
# rayfin.yml
id: ${PROJECT_NAME:-todo-app}

services:
  data:
    enabled: ${DATA_ENABLED:-true}
    connectionString: Server=${DB_HOST:-localhost};Port=${DB_PORT:-5432};Database=${DB_NAME:-tododb}

  auth:
    enabled: ${AUTH_ENABLED:-false}
    issuer: ${AUTH_ISSUER}
    audience: ${AUTH_AUDIENCE:-https://api.example.com}

  storage:
    enabled: ${STORAGE_ENABLED:-true}
    accountName: ${STORAGE_ACCOUNT:-devstoreaccount1}
```

```bash
# rayfin/.env
PROJECT_NAME=my-todo-app
DB_HOST=production-db.example.com
DB_PORT=5432
DB_NAME=todos_prod
AUTH_ENABLED=true
AUTH_ISSUER=https://auth.example.com
STORAGE_ACCOUNT=prodstorageaccount
```

## Security Best Practices

1. **Never commit `.env` files** - They contain secrets and environment-specific values.
2. **Provide `.env.example`** - Document required variables for other developers.
3. **Use shell environment in CI/CD** - Override `.env` with build and deployment secrets.
4. **Validate required variables** - Omit default values for required configuration.

## Error Handling

Rayfin fails fast with clear error messages when variables are missing:

```text
❌ Environment variable 'DB_HOST' referenced in rayfin.yml (services.data.host) is not defined.
   Set it in .env file or shell environment.
```

This prevents configuration errors from reaching runtime.

## Environment Variable Reference

### Special Variables

- `RAYFIN_ENV_FILE` - Override default `.env` file path.
