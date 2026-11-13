# Migrate the TypeScript client to 2.0

This is a breaking application-client migration.
Upgrade the SDK packages and generated client wiring together to compatible 2.0 releases.
Existing generated 1.x apps are not automatically rewritten; keep their compatible dependency set until you explicitly upgrade.
No database migration or backend route change is required.

## Upgrade checklist

- [ ] Install compatible versions of the client and each factory-owning package you use.
- [ ] If the app uses Functions, upgrade `@microsoft/fabric-user-data-functions` and its runtime SDK dependencies together.
- [ ] Replace default imports and direct constructors with named `RayfinClient.create`.
- [ ] Select exactly one authentication adapter.
- [ ] Register every required capability explicitly.
- [ ] Move schema types to adapters and infer your application client type.
- [ ] Import schema/capability types from their owning packages, not core re-exports, so strict TypeScript consumers can retain a minimal installation.
- [ ] Move connector configs, middleware, decoders, and environment to `connectorsService`.
- [ ] Replace subclasses and protected transport access with custom factories.
- [ ] Update mocks to structural contracts and run your app's type-check, tests, and build.

## Coordinate the Functions worker upgrade

The coordinated dependency set includes packages outside the `@microsoft/rayfin-*` namespace.
An app using Functions must also install a compatible `@microsoft/fabric-user-data-functions` worker.
That worker depends on `@microsoft/rayfin-client`, `@microsoft/rayfin-data`, and `@microsoft/rayfin-core`; include their runtime dependency closure in the upgrade.
Updating the frontend client or the `@microsoft/rayfin-functions` capability package alone does not upgrade the Functions worker.

Check the Functions workspace and any shared workspace that exchanges data-client types with it, not just the frontend.
Their installed SDKs must be compatible with the upgraded worker.
Verify the resolved worker version and package entry points even when frontend tests pass.
Use the application's package manager to update the relevant manifests and lockfile, applying scoped overrides or resolutions only when necessary.
Do not force unrelated CLI tooling onto the application's SDK dependency set with blanket overrides.

## Removed exports and constructors

The following are historical 1.x forms, not supported 2.0 APIs:

| Before (1.x)                                                               | After (2.0)                                                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `import RayfinClient from '@microsoft/rayfin-client'`                      | Named `import { RayfinClient }`                                                                                                  |
| `new RayfinClient<Data, Functions>(config)`                                | `RayfinClient.create` with explicit auth, data, and functions adapters                                                           |
| `new ConnectorsRayfinClient<Data, Functions, Connectors>(config, runtime)` | Register `connectorsService<Connectors>({ configs, runtime })` alongside other needed services                                   |
| Local Node `ConnectorsRayfinClient` with omitted `host`                    | Pass `host: { type: 'cli' }` to `connectorsService` when retaining CLI middleware; deployed Node apps use the standalone default |
| `ExtendableRayfinClient.create<Data, Services>(config)`                    | Register ordinary synchronous factories in `services`                                                                            |
| `new RayfinServerClient(config)`                                           | `RayfinClient.create` with `suppliedToken`                                                                                       |
| `RayfinClientBase`, extension aliases, protected-transport subclasses      | Custom service factories receiving the shared transport                                                                          |
| `@microsoft/rayfin-client/experimental` or `/experimental/index`           | Main client entry point plus adapters from owning packages                                                                       |
| `useProxy: true` with no `baseUrl`                                         | Remove `useProxy` and set `baseUrl: ''` explicitly for same-origin routing                                                       |

There are no compatibility wrappers or default client export in 2.0.
Do not merely rename a constructor: capabilities that used to be implicit must now be registered.

## Compose capabilities

For example, replace the historical browser classes above with this application-owned factory.
The app must already have generated schema/config modules and the matching capability and connector runtime packages installed.
Resolve configuration before calling the synchronous constructor:

```typescript
import {
  RayfinClient,
  RayfinConfigError,
  resolveRayfinConfig,
} from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { dataService } from '@microsoft/rayfin-data';
import { functionsService } from '@microsoft/rayfin-functions';
import { connectorsService } from '@microsoft/rayfin-connectors';
import { storageService } from '@microsoft/rayfin-storage';
import { eventhouse } from '@microsoft/rayfin-connector-eventhouse';
import type { AppSchema } from './rayfin/data/schema';
import type { AppFunctionsSchema } from './rayfin/functions/schema';
import type { AppConnectorsSchema } from './rayfin/connectors/schema';
import { connectorConfig as telemetryConfig } from './rayfin/connectors/telemetry/schema';
import type { AppStorageSchema } from './rayfin/storage/schema';

const config = await resolveRayfinConfig({
  apiUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
});

export function createClient() {
  const { baseUrl, publishableKey, runtimeConfig } = config;
  if (typeof baseUrl !== 'string') {
    throw new RayfinConfigError(
      'Configure a Rayfin backend URL.',
      'CONFIG_INCOMPLETE'
    );
  }
  if (typeof publishableKey !== 'string' || !publishableKey.trim()) {
    throw new RayfinConfigError(
      'Configure a Rayfin publishable key.',
      'CONFIG_INCOMPLETE'
    );
  }

  return RayfinClient.create({
    baseUrl,
    publishableKey,
    runtimeConfig,
    auth: browserSession({ storage: true }),
    services: {
      data: dataService<AppSchema>(),
      functions: functionsService<AppFunctionsSchema>(),
      connectors: connectorsService<AppConnectorsSchema>({
        configs: { telemetry: telemetryConfig },
        runtime: { telemetry: eventhouse() },
      }),
      storage: storageService<AppStorageSchema>(),
    },
  });
}

export type AppClient = ReturnType<typeof createClient>;
```

This example assumes the connector schema declares only `telemetry`; supply a config for every connector your schema declares.
The resolver can return missing values when neither runtime configuration nor the supplied defaults provides them.
Validate and explicitly pass narrowed fields rather than spreading its optional result into the required client configuration.
Check the URL's type rather than its truthiness so `baseUrl: ''` remains valid.
Remove services your app does not use; an auth-only client can omit `services`.
Existing operation call sites remain on `client.data`, `client.functions`, `client.connectors`, and `client.storage`.
Do not pass `schema: {} as AppSchema`, positional schema parameters, or a handwritten service-result intersection.

Capability types now also come from their owning packages.
Import `EntitySchema` and `TypedDataClients` from `@microsoft/rayfin-data`, `FunctionsSchema` from `@microsoft/rayfin-functions`, and connector types such as `ConnectorsSchema` from `@microsoft/rayfin-connectors`, not from the client package.
The client continues to re-export shared factory/transport types from `@microsoft/rayfin-lib`.
This keeps a minimal JavaScript import and a strict TypeScript consumer free of undeclared optional capability dependencies.

## Browser session options

Historical top-level auth flags move into the auth adapter:

| Before (1.x client config) | After (`browserSession` options) |
| -------------------------- | -------------------------------- |
| `authStorage`              | `storage`                        |
| `persistSession`           | `persistSession`                 |
| `autoRefreshToken`         | `autoRefreshToken`               |
| `multiTabSync`             | `multiTabSync`                   |

```typescript
import { browserSession } from '@microsoft/rayfin-auth';

const auth = browserSession({
  storage: false,
  persistSession: false,
  autoRefreshToken: false,
  multiTabSync: false,
});
```

Pass `auth` to `RayfinClient.create`.
These are the existing `AuthOptions`, including configured token storage, not a second set of client flags.
Persistence and proactive refresh default to enabled; multi-tab synchronization retains its environment-sensitive default and storage remains lazily initialized.
The session API, refresh behavior, and companion-provider hooks remain available through `client.auth`, including protected Fabric authentication flows.

## Server, worker, and supplied-token clients

Historical server construction becomes an explicit adapter selection:

```typescript
import { RayfinClient, suppliedToken } from '@microsoft/rayfin-client';
import { dataService } from '@microsoft/rayfin-data';
import type { AppSchema } from './rayfin/data/schema';

export function createClient(
  baseUrl: string,
  publishableKey: string,
  getAccessToken: () => string | null | Promise<string | null>
) {
  return RayfinClient.create({
    baseUrl,
    publishableKey,
    auth: suppliedToken({ accessToken: getAccessToken }),
    services: { data: dataService<AppSchema>() },
  });
}

export type AppClient = ReturnType<typeof createClient>;
```

Callbacks may return a token synchronously or resolve one asynchronously, as with MSAL or Azure credentials.
The provider is read for each request, so it can acquire or return a rotated token without caching one forever.
`RayfinClient.create` remains synchronous and does not call the provider; each request awaits its token before sending, and provider failures reject that request without sending it.
A fixed string is also supported.
`suppliedToken()` without a token sends the publishable key only, where backend authorization allows it.
This mode exposes no `client.auth`, starts no browser session, and does not manage token acquisition or offer interactive sign-in.
Do not combine an adapter with legacy top-level token-provider or refresh-hook settings.

## Custom token refresh and exhaustion

The old `getAccessToken`, `onRefreshNeeded`, and `onAuthExhausted` client fields are removed.
Use `suppliedToken({ accessToken: getAccessToken })` for an externally managed synchronous or asynchronous token provider.
Use `browserSession()` when Rayfin should manage the browser session and refresh.
Neither shipped adapter accepts custom `onRefreshNeeded` or `onAuthExhausted` options.
For an application-owned provider that needs those hooks, attach them in a synchronous custom auth factory:

```typescript
import { RayfinClient, type ClientAuthFactory } from '@microsoft/rayfin-client';

export function createExternalAuthClient(
  baseUrl: string,
  publishableKey: string,
  getAccessToken: () => string | null,
  onRefreshNeeded: () => Promise<void>,
  onAuthExhausted: () => void
) {
  const auth: ClientAuthFactory<undefined> = (http) => {
    http.setAccessTokenCallback(getAccessToken);
    http.setRefreshCallback(onRefreshNeeded);
    http.setAuthExhaustedCallback(onAuthExhausted);
    return undefined;
  };
  return RayfinClient.create({
    baseUrl,
    publishableKey,
    auth,
    services: { reports: (http) => ({ load: () => http.get('/reports') }) },
  });
}
```

After an authenticated request receives HTTP 401, the transport awaits `onRefreshNeeded` and retries with the current token.
Update the token read by `getAccessToken` before the refresh hook completes.
If the retry is also unauthorized, `onAuthExhausted` runs and the transport surfaces the failure.
This adapter exposes no `client.auth` and does not create a browser session.
Register synchronous cleanup with the factory's lifecycle argument if the provider acquires resources for this client.
Do not use an async auth factory or return a promise from it; async work during a request is distinct from client construction.

## Preserve configuration and routing

Both auth modes require a defined base URL and a nonblank publishable key.
Use `baseUrl: ''` only for intentional same-origin routing.
The 1.x constructor treated `useProxy: true` with an omitted URL as `baseUrl: ''`.
That shim and the composed client's `useProxy` option are removed in 2.0.
An omitted URL fails with `MISSING_BASE_URL`; supplying `useProxy` with a valid URL fails preflight with `INVALID_CONFIG`, before authentication or services initialize.
Remove the option rather than moving it into an auth or capability adapter.
The low-level `ApiClient` retains its separate deprecated option for existing direct consumers.
Keep `resolveRayfinConfig` ahead of construction: runtime configuration wins over local fallback values; real load or validation errors must not be silently treated as missing configuration.
`client.runtimeConfig` retains resolved deployment metadata.

All adapters receive the same fully configured transport.
Transport options such as fetch, headers, timeout, and `functionsBaseUrl` remain transport-level settings.
An explicit moniker wins over `runtimeConfig.itemId`.

- `dataService` retains `/graphql` relative to the backend base and its app-owned ID conveniences, fluent queries, selections, and relationship traversal.
- GraphQL-backed connectors retain `/connectors/{name}/graphql` relative to the configured backend base, their separate key/selection metadata, composite-key and keyless behavior, CRUD gates, and dialect-specific mutation results.
- Operation connectors retain `/connector-invoke/{name}` relative to that base and delegated connection/consent/provisioning behavior.
- `functionsBaseUrl` overrides function routing, not data, connectors, or storage routes.
- Connector target endpoints and credentials remain server-owned; do not put arbitrary remote GraphQL or MCP URLs into the Rayfin `baseUrl`.

### Vite local development

If upgrading an older `@microsoft/rayfin-local-dev`, replace its `/vite` import with the existing experimental entry point:

```typescript
import { rayfinLocalDev } from '@microsoft/rayfin-local-dev/experimental/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [rayfinLocalDev()],
});
```

This companion-package export rename predates client convergence; the client migration does not change it.
Leave `functionsBaseUrl` unset to use the normal `/functions/<name>/invoke` route.
The adapter forwards that route to a configured local Functions host, or to the configured backend when no local Functions host is configured.
If a configured local host is unavailable, the adapter returns HTTP 502 instead of silently executing deployed function code.
An explicit `functionsBaseUrl` obtained from `resolveRayfinFunctionsBaseUrl()` retains the separate local `/.rayfin/api/<name>` route.
See the [local development reference](../../../../tools/local-dev/assets/docs/index.md).

## Connector runtime and environment

Template and pack authors should remove `services.connectors.enabled` from `rayfin.yml` and pack manifests.
Connector source declarations remain under the top-level `connectors` configuration; register the client API under `services.connectors` using `connectorsService`.

`connectorsService<Schema>({ configs, runtime?, host? })` requires an exhaustive config map keyed by the schema's connector names.
Keep those names aligned with `rayfin.yml` and the generated `connectorConfig` exports.
Missing runtime registration does not become automatic discovery: register connector-owned hooks such as `eventhouse()`, `fabricSemanticModel()`, `fabricDataAgent()`, or `fabricIqMcp()` where required.
Their middleware and binary decoders remain necessary for the declared result types.
Unknown untyped connector access still produces `UNKNOWN_CONNECTOR`.

Omitted `host` explicitly means standalone, including deployed Node.js apps.
Use `host: { type: 'cli' }` only for an actual CLI caller.
Pass a verified embedded host context for Fabric embedding rather than inferring it from an iframe or the absence of browser globals.
See the [connector runtime guide](../../../../guide/assets/docs/cli/connectors/category-b-function-bridge.md).

### Local Node scripts versus deployed Node apps

The 1.x `ConnectorsRayfinClient` auto-detected `cli` when `window` was absent.
In 2.0, `connectorsService` deliberately defaults to `standalone` even in Node.
For a local script that needs the old CLI middleware path, register the host explicitly:

```typescript
services: {
  connectors: connectorsService<AppConnectorsSchema>({
    configs: connectorConfigs,
    runtime: connectorRuntimes,
    host: { type: 'cli' },
  }),
}
```

Select `cli` only when the connector runtime is configured for that local execution path.
For example, the semantic-model runtime can use its direct Power BI transport in a configured CLI host instead of delegating to the app backend.
The host flag does not acquire tokens or change the supplied identity; the caller must configure the target and suitable authentication.
Keep the standalone default for deployed Node apps that should use app-backend routing and authorization.

The low-level `createConnectorsApi` retains host auto-detection when its host argument is omitted, including `cli` without browser globals.
Its default therefore differs intentionally from the composed adapter's default.

## Custom factories and protected-transport subclasses

Historical extension classes and subclasses that accessed a protected transport must become ordinary factories.
The transport and lifecycle contracts are in `@microsoft/rayfin-lib`; optional packages do not depend on the client core.

```typescript
import { RayfinClient, suppliedToken } from '@microsoft/rayfin-client';
import type { ClientServiceFactory } from '@microsoft/rayfin-lib';

const healthService: ClientServiceFactory<{ check(): Promise<unknown> }> = (
  http,
  lifecycle
) => {
  const timer = setInterval(() => {}, 60_000);
  lifecycle.onDispose(() => clearInterval(timer));
  return { check: () => http.get('/health') };
};

export function createClient(baseUrl: string, publishableKey: string) {
  return RayfinClient.create({
    baseUrl,
    publishableKey,
    auth: suppliedToken(),
    services: { health: healthService },
  });
}

export type AppClient = ReturnType<typeof createClient>;
```

Factories receive the authenticated `ApiClient` first and a lifecycle context second.
A plain `(http) => service` factory remains valid.
For example, replace historical subclass fields such as `storage = createStorageClient<StorageSchema>(this.apiClient)` with `services: { storage: storageService<StorageSchema>() }` at construction.
Do not expose a protected transport or extend an application-client base class to add capabilities.
Existing `createDataApi`, `createFunctionsApi`, `createConnectorsApi`, `createStorageClient`, and other low-level factories remain public for direct consumers; this migration does not remove another package's `ServicePlugin`.
Register cleanup immediately after acquiring a resource, even if later initialization might throw.
Factories and cleanup must be synchronous; factories return a non-null object or function, never a promise or plain thenable.
Factories must not discover or depend on sibling services during construction.

Registration is construction-only.
The client has real own, enumerable, non-writable, non-configurable service properties and no outer proxy; capability-level lazy proxies remain.
Do not replace, delete, or dynamically add a registration.

Reserved names include `auth`, `runtimeConfig`, `dispose`, `constructor`, `prototype`, `__proto__`, `then`, `catch`, and `finally`, plus core-client and object-prototype member names such as `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, and `__lookupSetter__`.
Symbol keys are unsupported.
Validation occurs before auth or factories initialize.
Invalid names, factories, and results use `INVALID_SERVICE_NAME`, `INVALID_SERVICE_FACTORY`, and `INVALID_SERVICE_RESULT`; initialization failures identify the component and preserve the original error as `cause`.

## Disposal and errors

Call `client.dispose()` when the owning application scope ends.
It synchronously closes the shared transport to new requests, then runs all registered cleanup in reverse order, including auth cleanup after later services.
Subsequent transport requests, including raw and isolated paths, fail with `CLIENT_DISPOSED` before network activity.
It does not cancel every in-flight operation, sign out, revoke tokens, delete stored credentials, or disable arbitrary pure methods on custom service objects.

Disposal closes admission rather than draining pending work.
An already-dispatched request can return normally, but any continuation requiring another send, including a 401 refresh/retry, fails with `CLIENT_DISPOSED`.
A request still preparing headers or waiting for the fetch implementation cannot dispatch after disposal.
New browser-session refreshes, including those queued behind initialization, provider sign-in, or a refresh lock, reject with `AUTH_DESTROYED`.
An already-issued refresh can finish and persist rotated credentials, subject to the existing checks against replacing a newer sign-in or sign-out.
Discarding that result could leave the persisted session with a refresh token the server has already invalidated.
Completion does not restart auth timers or browser listeners.
`dispose()` does not wait for pending requests or storage writes and is not a guarantee that all side effects have stopped.

Cleanup continues even when one callback throws and reports all cleanup failures.
Returning a promise or thenable from cleanup is also reported as `INVALID_CLEANUP_RESULT`; disposal does not wait for it, and unsupported rejections are retained as its cause.
Construction failure also cleans up; the initialization failure remains primary and cleanup failures are reported separately.
Subsequent disposal is a no-op, even after cleanup errors.
Deferred browser-session initialization cannot restore state, register resources, or start eager refresh after destruction.

`ClientCompositionError` extends the canonical `SdkError` and exposes readonly `cause: unknown` and `cleanupErrors: readonly unknown[]`.
Initialization failures identify the failed component, retain the original exception in `cause`, and expose any rollback cleanup failures in `cleanupErrors`.
If the original exception is an `SdkError` with a code, the composition error preserves that code; otherwise it uses `SERVICE_INITIALIZATION_FAILED`.
Disposal cleanup failures use `CLIENT_DISPOSE_FAILED`, with an `AggregateError` as `cause` and all cleanup failures in `cleanupErrors`.
Preflight validation throws `SdkError` before initialization rather than wrapping it as an initialization failure.

| Code                            | Meaning                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_CONFIG`                | Client configuration is missing, is not an object, or contains the removed `useProxy` option.                                      |
| `MISSING_BASE_URL`              | `baseUrl` is not a string; use `''` for intentional same-origin routing.                                                           |
| `MISSING_PUBLISHABLE_KEY`       | The publishable key is missing, is not a string, or is blank.                                                                      |
| `MISSING_AUTH_MODE`             | The auth adapter is missing or is not a function.                                                                                  |
| `INVALID_AUTH_CONFIG`           | Legacy top-level auth options conflict with adapter ownership, or a supplied token is neither a string nor a synchronous provider. |
| `INVALID_SERVICE_NAME`          | A registration uses a reserved name or a symbol key.                                                                               |
| `INVALID_SERVICE_FACTORY`       | The service map or a factory/cleanup registration is invalid, including an async factory.                                          |
| `INVALID_SERVICE_RESULT`        | An initialized factory returns a null, primitive, or promise result instead of a synchronous API.                                  |
| `SERVICE_INITIALIZATION_FAILED` | Initialization throws without an existing SDK error code to preserve.                                                              |
| `CLIENT_DISPOSE_FAILED`         | Synchronous cleanup failed; inspect `cleanupErrors`.                                                                               |
| `CLIENT_DISPOSED`               | A new shared-transport request or cleanup registration is attempted after disposal.                                                |
| `AUTH_DESTROYED`                | A browser-session refresh or refresh scheduling is attempted after auth teardown, including a refresh waiting to start.            |

Use the named canonical `SdkError`, `NetworkError`, and `AuthError` exports, shared with `@microsoft/rayfin-lib`.
Do not use the historical `RayfinClient.errors` namespace or rely on a separate client-local auth error identity.

## Verify the upgrade

### Verify dependency resolution

Inspect the installed dependency graph from the application root and each consuming frontend, shared, and Functions workspace.
For an npm application, start with:

```shell
npm ls @microsoft/fabric-user-data-functions @microsoft/rayfin-client @microsoft/rayfin-data @microsoft/rayfin-core --all
```

In an npm workspace application, repeat the check with `--workspace <workspace-name>` for each consumer.
Also record the actual package entry point resolved from each consuming workspace directory; for example:

```shell
node --input-type=module -e "console.log(import.meta.resolve('@microsoft/rayfin-data'))"
```

Repeat this entry-point check for the other packages that workspace consumes.
Inspect copies nested beneath both the worker and client packages, as well as workspace-local installations; a compatible root-level copy does not establish that every consumer resolves it.
Use `npm explain @microsoft/rayfin-data` to identify which dependency introduced each copy.
Multiple physical copies are not necessarily incorrect, but all copies participating in the application's client/worker boundary must be compatible.
When using locally built packages, matching version strings alone do not prove that the installed copies came from the same build.

If the Functions build reports TS2345 for incompatible `GraphQLEntityClient` types, or says `bindPublicOperations` is missing, first inspect the resolved paths in the diagnostic for mixed SDK copies.
Correct the dependency installation and re-run the checks before changing application types.
Do not conceal an incompatible installation with casts, shims, skipped type checking, or TypeScript source aliases.

### Run application validation

Run your app's existing type-check, tests, and production build against the installed package entry points.
Include the Functions workspace's real TypeScript build and any shared workspace build before deploying; a frontend build alone is insufficient.
Re-run validation after correcting dependency resolution.
Check both browser-session and supplied-token flows that your app uses, connector decoder behavior, and shutdown ownership.
No example in this guide substitutes for compilation against your generated schemas and the final coordinated SDK build.
