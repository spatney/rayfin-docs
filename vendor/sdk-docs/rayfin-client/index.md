---
symbols: []
---

# Rayfin application client

`RayfinClient.create` assembles an ordinary typed object from an explicit auth adapter and synchronous service factories.
The core has one runtime dependency layer, `@microsoft/rayfin-lib`; optional capability implementations stay in their owning packages.
There are no automatic data, functions, connectors, or storage registrations.

## Choose authentication

```typescript
import { RayfinClient, suppliedToken } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';

const config = {
  baseUrl: 'https://your-backend.example',
  publishableKey: 'pk-your-key',
};

const browser = RayfinClient.create({
  ...config,
  auth: browserSession({ storage: true }),
});

const server = RayfinClient.create({
  ...config,
  auth: suppliedToken(),
});
```

The browser client exposes the existing session API as `browser.auth`.
The supplied-token client has no `auth` property and acquires no user token.
Pass `suppliedToken({ accessToken })` with a string or a synchronous or asynchronous callback for bearer-token requests; omit it only where the backend permits publishable-key-only access.
Client construction remains synchronous; the callback is awaited per request, and token acquisition or rotation remains its responsibility.
Both modes require a nonblank publishable key and a defined `baseUrl`; `''` explicitly selects same-origin routing.

## Register capabilities

| Namespace    | Adapter                                                                | Import from                    |
| ------------ | ---------------------------------------------------------------------- | ------------------------------ |
| `data`       | `dataService<AppSchema>()`                                             | `@microsoft/rayfin-data`       |
| `functions`  | `functionsService<AppFunctionsSchema>()`                               | `@microsoft/rayfin-functions`  |
| `connectors` | `connectorsService<AppConnectorsSchema>({ configs, runtime?, host? })` | `@microsoft/rayfin-connectors` |
| `storage`    | `storageService<AppStorageSchema>()`                                   | `@microsoft/rayfin-storage`    |

Place the adapters in `services` at construction.
Schemas belong on each adapter, not on the client or a fabricated runtime `schema` option.
Import capability types from their owning packages too; the client does not re-export their declarations.
Export `type AppClient = ReturnType<typeof createClient>` from your application factory.
See the [complete composition example](migration-v2.md#compose-capabilities).

App-owned `data` and connector entities keep different APIs and backend routes.
Composition does not change CRUD permissions, composite keys, relationship handling, connector operation types, or decoder requirements.
Connector configuration, runtime hooks, and execution environment belong on `connectorsService`; omitted `host` means standalone, including in Node.js.

## Configuration and lifecycle

Resolve deployment settings with `resolveRayfinConfig` before construction.
All registered services share the same configured transport, including fetch, headers, timeout, and `functionsBaseUrl`.
An explicit moniker takes precedence over the resolved item ID.

Registrations are construction-only, readonly, enumerable, non-configurable own properties.
There is no outer client proxy, asynchronous plugin loader, or mutable service registry.
See [reserved names and custom factories](migration-v2.md#custom-factories-and-protected-transport-subclasses).

Call `client.dispose()` for synchronous local cleanup.
It closes the transport to new requests and releases owned resources in reverse initialization order; it does not sign out, delete persisted credentials, or promise cancellation of all in-flight operations.
Already-dispatched requests may finish, but cannot send a retry after disposal.
New or queued browser-session refreshes are rejected; an already-issued refresh may finish and persist rotated credentials without restarting background resources.
Disposal does not wait for network or storage completion.

Initialization and cleanup failures use `ClientCompositionError`, which extends the canonical `SdkError` and exposes readonly `cause` and `cleanupErrors`.
See [disposal and error codes](migration-v2.md#disposal-and-errors) for validation, initialization, and disposal failures.

## Upgrade and reference

- [2.0 migration guide](migration-v2.md)
- [Package README](../../README.md)
