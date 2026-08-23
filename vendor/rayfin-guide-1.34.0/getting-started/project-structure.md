---
sidebar_position: 3
title: Project structure
---

Rayfin templates follow a consistent layout so data models, backend configuration, and frontend code stay discoverable.
This page explains the important folders you will see after running `npm create @microsoft/rayfin@latest`.

## Folder layout

```text
your-project/
├── rayfin/
│   ├── data/
│   │   ├── schema.ts
│   │   └── *.ts
│   ├── .env
│   ├── rayfin.yml
│   └── tsconfig.json
├── src/
├── package.json
├── tsconfig.json
└── README.md
```

## Key files

### rayfin/rayfin.yml

`rayfin/rayfin.yml` is the entrypoint for the Rayfin backend configuration.
It controls which services run in `npx rayfin up`, and it supports environment variable interpolation.

Full example:

```yaml
id: my-app
name: my-app
version: 1.0.0
services:
  auth:
    enabled: true
    expiryInMinutes: 60
    refreshToken:
      lifetimeInDays: 30
    customClaims:
      tenant: "default"
    scopes:
      - read:data
      - write:data
    allowedRedirectUris:
      - http://localhost:5173
    password:
      enabled: true
    fabric:
      enabled: false
    passwordless:
      magicLink:
        enabled: false
        expiryMinutes: 15
      smsOtp:
        enabled: false
    email:
      enabled: false
      provider: smtp
      senderName: Rayfin Platform
      verificationTokenExpirationHours: 24
      passwordResetTokenExpirationMinutes: 30
      smtp:
        host: maildev
        port: 1025
        senderEmail: noreply@rayfin.local
        username: ""
        password: ""
        useSsl: false
        useStartTls: false
        webPort: 1080
  data:
    enabled: true
    dialect: mssql
  storage:
    enabled: false
  staticHosting:
    enabled: true
    root: .
    folder: dist
    buildCommand: npm run build
    indexDocument: index.html
```

#### Top-level fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | Project slug used as the Docker Compose project name and Fabric item identifier. |
| `name` | `string` | Yes | Human-readable project display name. |
| `version` | `string` | Yes | Project version (semver). |
| `services` | `object` | Yes | Service configuration block (see below). |

#### `services.data`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable the data service. |
| `dialect` | `"mssql"` \| `"postgresql"` | `"mssql"` | Database dialect. Fabric deployments support MSSQL only. |

#### `services.auth`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable the auth service. |
| `expiryInMinutes` | `number` | — | JWT token expiry in minutes. |
| `customClaims` | `Record<string, string>` | — | Custom claims added to issued JWTs. |
| `scopes` | `string[]` | — | OAuth scopes (e.g. `["read:data", "write:data"]`). |
| `refreshToken.lifetimeInDays` | `number` | — | Refresh token lifetime in days. |
| `allowedRedirectUris` | `string[]` | `["http://localhost:5173"]` | Allowed redirect URIs for auth callbacks and Fabric brokered auth handoff. Must include the bare origin for Fabric auth. |

**`services.auth.password`**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Enable email + password authentication. |

**`services.auth.fabric`**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable Fabric brokered authentication (Entra ID SSO). |

**`services.auth.passwordless`**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `magicLink.enabled` | `boolean` | `false` | Enable magic link authentication. |
| `magicLink.expiryMinutes` | `number` | `15` | Magic link expiration in minutes. |
| `smsOtp.enabled` | `boolean` | `false` | Enable SMS OTP authentication. |

**`services.auth.email`**

Configure an email provider for magic links, password resets, and email verification.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable email service. Required for magic link auth. |
| `provider` | `string` | `"smtp"` | Email provider type. |
| `senderName` | `string` | `"Rayfin Platform"` | Display name for outgoing emails. |
| `verificationTokenExpirationHours` | `number` | `24` | Email verification token expiry in hours. |
| `passwordResetTokenExpirationMinutes` | `number` | `30` | Password reset token expiry in minutes. |

**`services.auth.email.smtp`**

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `host` | `string` | `"maildev"` | SMTP server hostname. |
| `port` | `number` | `1025` | SMTP server port. |
| `senderEmail` | `string` | `"noreply@rayfin.local"` | Sender email address. |
| `username` | `string` | `""` | SMTP username. |
| `password` | `string` | `""` | SMTP password. |
| `useSsl` | `boolean` | `false` | Use SSL for the SMTP connection. |
| `useStartTls` | `boolean` | `false` | Use STARTTLS for the SMTP connection. |
| `webPort` | `number` | `1080` | MailDev web UI port (local development only). |

#### `services.storage`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable the storage service. |

#### `services.staticHosting`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `false` | Enable static content hosting. |
| `root` | `string` | — | Root directory of the frontend project (relative to the project root). |
| `folder` | `string` | `"dist"` | Directory containing built static assets (relative to `root`). |
| `buildCommand` | `string` | — | Shell command to run before packaging (e.g. `npm run build`). |
| `indexDocument` | `string` | — | Default document served for the root path (e.g. `index.html`). |

> **Tip:** All string values support environment variable interpolation with `${VAR}` and `${VAR:-default}` syntax.
> Variables are resolved from `rayfin/.env` and the shell environment.
> See [Environment Variable Interpolation](../cli/env-interpolation.md) for details.

### rayfin/.env

`rayfin/.env` is an optional environment file used to supply values to `rayfin.yml` via interpolation.
Do not commit secrets, and prefer a `rayfin/.env.example` file for documentation.

### rayfin/data/*.ts

Files in `rayfin/data/` define your entities.
Entities are TypeScript classes decorated with `@entity()` plus field decorators like `@uuid()` and `@text()`.

### rayfin/data/schema.ts

`rayfin/data/schema.ts` maps entity names to their classes.
The Rayfin client uses this map to provide type-safe access to `client.data.<Entity>`.

### rayfin/tsconfig.json

`rayfin/tsconfig.json` is a project-reference tsconfig used by the Rayfin CLI to compile your entity definitions.
It extends your root `tsconfig.json` and overrides the settings Rayfin needs (for example, `composite: true` and Node.js module resolution).
You should not need to edit this file.

### rayfin/.temp/

`rayfin/.temp/` contains generated backend artifacts.
If the backend appears to be using stale schema or configuration, stop the dev stack and rerun `npx rayfin up` to regenerate.

### tsconfig.json (root)

Your root `tsconfig.json` must meet several requirements for Rayfin decorators and the `rayfin/` sub-project to work correctly.

**Project reference to `rayfin/`** — Add a `references` entry so TypeScript knows about the Rayfin sub-project:

```json
{
  "references": [{ "path": "./rayfin" }]
}
```

> **Note:** Do not set `emitDecoratorMetadata` to `true`.
> TypeScript only allows it alongside `experimentalDecorators`, which is incompatible with Rayfin's TC39 decorators.

**Minimal example:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "ESNext.Decorators"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "importHelpers": false,
    "strict": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./rayfin" }]
}
```

> **Tip:** Templates created with `npm create @microsoft/rayfin@latest` already include these settings.
> If you are integrating Rayfin into an existing project, verify your `tsconfig.json` matches the requirements above.

## Frontend configuration

### Vite configuration

Rayfin decorators use the TC39 Stage 3 decorator specification, which requires an ES2022 or later compilation target.
Set the `target` to `es2022` in your `vite.config.ts` so Vite, esbuild, and dependency pre-bundling all use the correct language level.

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
```

> **Tip:** Templates created with `npm create @microsoft/rayfin@latest` already include these settings.
> If you are integrating Rayfin into an existing Vite project, add the three `target` entries shown above.
>
> **Note:** Use the default `@vitejs/plugin-react` plugin (esbuild-based).
> `@vitejs/plugin-react-swc` only supports legacy/experimental decorators and fails to parse Rayfin's TC39 decorators with an `Expression expected` error — regardless of the `target` setting.

### Environment variables

Rayfin manages environment variables through `rayfin/.env` using the `RAYFIN_PUBLIC_*` prefix convention.
When you run `npm run dev`, the `predev` hook calls `rayfin env --framework vite` to generate a `.env.local` file with framework-specific variable names.
When the CLI detects a Vite or Next.js project automatically, you can omit `--framework`.

The following Vite variables are available in your frontend code after generation:

- `VITE_RAYFIN_API_URL` — Base URL pointing the frontend at the Rayfin backend.
  Sourced from `RAYFIN_PUBLIC_API_URL` in `rayfin/.env`.
- `VITE_RAYFIN_PUBLISHABLE_KEY` — Publishable key used for Rayfin client authentication.
  Sourced from `RAYFIN_PUBLIC_PUBLISHABLE_KEY` in `rayfin/.env`.

To override values, edit `rayfin/.env` directly and re-run `rayfin env --framework vite` (or `npm run dev`, which triggers it automatically).
