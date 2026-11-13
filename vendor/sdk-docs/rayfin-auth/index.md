---
symbols:
  - browserSession
  - Auth
  - AuthOptions
---

# @microsoft/rayfin-auth

Authentication helpers and client-side auth utilities for Rayfin Builder apps.

This package ships its own docs via the `rayfinDocs` field convention
(see [docs-package-architecture](https://github.com/microsoft/project-rayfin/tree/main/openspec/changes/docs-package-architecture)).
For the full TypeDoc reference, see the bundled docs at
`ts-sdk/@microsoft/rayfin-auth/` accessible via `rayfin docs list --module ts-sdk`.

## Installation

```bash
npm install @microsoft/rayfin-auth
```

## Quickstart

Select browser-session authentication explicitly when composing a client:

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';

const client = RayfinClient.create({
  baseUrl: '',
  publishableKey: 'pk-your-key',
  auth: browserSession({ storage: true }),
  services: {},
});

await client.auth.signIn({
  email: 'user@example.com',
  password: 'your-password',
});

const session = client.auth.getSession();
client.dispose();
```

`browserSession(options?)` returns the existing `Auth` session API as `client.auth` and attaches authentication before any registered service initializes.
All registered services share that authenticated transport.
Register capabilities with their owning package's service adapter; no data, functions, connectors, or storage service is added implicitly.

## Session options and lifecycle

The adapter accepts the same `AuthOptions` as `Auth`: `storage`, `storageKeyPrefix`, `persistSession`, `autoRefreshToken`, `multiTabSync`, and `refreshTimeout`.
Use `storage: false` for an in-memory session, or pass an `AuthStorage` implementation for custom persistence.
Existing synchronous restoration and lazy asynchronous-storage initialization remain unchanged.

Disposal calls `Auth.destroy()` to release timers and browser listeners.
It does not sign out, revoke tokens, or delete persisted credentials.
New or queued refreshes reject with `AUTH_DESTROYED`, including those waiting for initialization, provider sign-in, or a refresh lock.
An already-issued refresh may still finish and persist rotated credentials without restarting timers or browser listeners.
This preserves the replacement refresh token when the server has already rotated it.
Existing protections against a late refresh replacing a newer sign-in or sign-out still apply.
Disposal does not wait for pending network calls or storage writes.
Do not use a disposed client for further requests.

## Fabric companion providers

The returned `client.auth` is an ordinary `Auth` instance.
Continue passing it to the Fabric companion provider exactly as before; provider-specific sign-in, runtime-settings discovery, and token-exchange hooks are unchanged.
See the [Fabric authentication guide](/docs/guide/auth/fabric) for that provider's setup.
The low-level `Auth` and `AuthApi` exports remain available for direct integrations.
