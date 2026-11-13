# Rayfin local development

`@microsoft/rayfin-local-dev` connects a Vite development server to the
backend and Functions hosts selected by `rayfin dev`.

## Vite adapter

The Vite adapter is a stable public entry point at `@microsoft/rayfin-local-dev/vite`.
Import it only in Node-side Vite configuration; import browser helpers from `@microsoft/rayfin-local-dev` instead.
Replace imports from `@microsoft/rayfin-local-dev/experimental/vite` with `@microsoft/rayfin-local-dev/vite`; the experimental path is no longer exported.

Register the adapter in `vite.config.ts`:

```ts
import { rayfinLocalDev } from '@microsoft/rayfin-local-dev/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [rayfinLocalDev({ autoLogin: true })],
});
```

The adapter serves `rayfin.config.json`, proxies the SDK's backend routes, and
forwards `/functions/<name>/invoke` to the local Functions host when one is
running. Leave `functionsBaseUrl` unset in Vite applications so local and
deployed calls use the same SDK route. The adapter returns HTTP 502 when a
configured local host is unavailable; it does not silently invoke deployed
code.
When no local Functions host is configured, the default `/functions/<name>/invoke` route forwards to the configured backend instead.
This preserves backend function execution when developing only the frontend locally.

## Welcome source activity

Use `rayfinLocalDev({ autoLogin: true, sourceActivity: true })` for the Universal App workspace welcome.
The opt-in development feed reports source-edit categories and counts across frontend and sibling packages.
It does not expose file contents or claim build completion, and it is inactive in production.
The implementation is package-owned, so fixes arrive through dependency updates rather than copied template scripts.
Remove the `sourceActivity` option when removing the welcome.

## Local authentication

Automatic local sign-in reuses the Rayfin CLI login, tenant selection, and
token cache. Run `rayfin login` to sign in ahead of time or switch accounts.
Do not add an Azure CLI or application-owned MSAL token cache.

The backend must enable the delegated exchange:

```yaml
services:
  auth:
    fabric:
      enabled: true
      externalEntraExchange: true
```

Preserve these boundaries:

- Keep `AuthGate` in the application. Public static assets do not make APIs or
  data anonymous.
- Keep local helpers behind `import.meta.env.DEV` and load them with a dynamic
  import so production bundles do not include the local sign-in endpoint.
- Do not treat local auto-login as validation of the deployed public signed-out
  screen. Validate that path in a clean browser session after deployment.
- Initialize embedded authentication before reusing a persisted session so a
  stale identity cannot bypass the current host handoff.

## Diagnostics

Enable namespaced configuration and request routing logs with:

```sh
NODE_DEBUG=rayfin-local-dev npm run dev
```

Tokens, authorization headers, and response bodies are not logged.
