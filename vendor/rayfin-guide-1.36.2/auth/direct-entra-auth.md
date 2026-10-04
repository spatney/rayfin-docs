---
sidebar_position: 4
---

# Direct Entra token sign-in

Use `signInWithEntraToken()` when your application already has a delegated Microsoft Entra access token and wants to call a Rayfin app as that user.
The helper exchanges it for a Rayfin session on your existing `Auth` instance, so attached SDK clients can make authenticated requests.
It works in browsers and Node.js without a popup, iframe, handoff code, or redirect.

For a portal signing in an embedded app rather than itself, use the [external embed host](./external-embed-host.md).
For a browser app that needs Fabric to perform interactive sign-in, use the [Fabric broker flow](./fabric.md).

## Prerequisites

Enable external Entra exchange in the target app's `rayfin/rayfin.yml` and deploy the updated configuration:

```yaml
services:
  auth:
    enabled: true
    fabric:
      enabled: true
      externalEntraExchange: true
```

The direct exchange must also be available in the target Fabric environment.
Your Entra token must:

- Be a delegated user token, not an app-only service principal token.
- Target the Fabric/Power BI audience accepted by the deployment.
- Include the delegated `Item.Execute.All` scope.
- Be issued in the target item's owning Fabric tenant.

The user must have Execute permission on that item.
For production Power BI, request the `https://analysis.windows.net/powerbi/api/Item.Execute.All` scope through your identity library.
Development environments may use a different resource.
The SDK does not acquire the Entra token or handle consent.

## Install

For an app using `RayfinClient`:

```bash
npm install @microsoft/rayfin-client @microsoft/rayfin-auth-provider-fabric
```

## Sign in an existing client

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import { signInWithEntraToken } from '@microsoft/rayfin-auth-provider-fabric';

const client = new RayfinClient({
  baseUrl: rayfinEndpoint,
  publishableKey,
});

const session = await signInWithEntraToken(client.auth, {
  entraToken,
});
console.log('Authenticated', session.isAuthenticated);
```

`rayfinEndpoint` is your trusted HTTPS AppBackend workload API base URL, including the deployment's capacity/workspace/artifact path.
Use the same backend base URL as your data client, not the app's static-hosting URL or the full token endpoint.
The helper preserves that path and appends `/api/auth/v1/brokered/token`; there is no separate endpoint option to keep in sync.
The base must be absolute HTTPS, including for localhost; relative proxy URLs and URLs containing credentials, query strings, or fragments are not accepted.
`entraToken` is the raw access token string without the `Bearer` scheme prefix.
Never accept the endpoint from an untrusted caller.

The helper establishes the session on `client.auth`.
Data and function operations on that client then use the Rayfin access token automatically.
The returned `OpaqueSession` exposes user and session metadata without exposing tokens.
Each call explicitly exchanges the supplied token; it does not skip the exchange just because a previous session exists.
Concurrent direct sign-ins on the same `Auth` instance run in invocation order.

## Node.js and standalone SDK clients

You can construct `Auth` and `ApiClient` directly without `RayfinClient`:

```bash
npm install @microsoft/rayfin-auth @microsoft/rayfin-lib @microsoft/rayfin-auth-provider-fabric
```

```typescript
import { Auth } from '@microsoft/rayfin-auth';
import { ApiClient } from '@microsoft/rayfin-lib';
import { signInWithEntraToken } from '@microsoft/rayfin-auth-provider-fabric';

const apiClient = new ApiClient({
  baseUrl: rayfinEndpoint,
  publishableKey,
});
const auth = new Auth(apiClient, { storage: false });
auth.attachToClient(apiClient);

try {
  const session = await signInWithEntraToken(auth, { entraToken });
  console.log('Authenticated', session.isAuthenticated);
  // Use data or other SDK clients configured with apiClient here.
} finally {
  auth.destroy();
}
```

Neither the import nor this direct sign-in requires `window`, `document`, or `localStorage`.
`storage: false` keeps the Rayfin session in memory.
Use separate instances per user in server applications; do not share mutable user sessions across requests from different users.
Call `auth.destroy()` when the instance is no longer needed to release its timers and listeners.
`RayfinServerClient` uses an access-token configuration instead of exposing `auth`, so it is not passed directly to this helper.

## Session lifetime

Persistence follows your `Auth` configuration.
The SDK does not persist the supplied Entra token in the Rayfin session.
Subsequent refresh uses the Rayfin refresh token through the ordinary auth flow rather than repeating the external exchange.
If the session can no longer refresh, obtain another Entra token and explicitly sign in again.

## Errors and browser considerations

The helper rejects with `AuthError` rather than returning a previous session as a successful sign-in.
On failure, an existing unexpired session remains in memory; successful sign-in replaces it without revoking the previous server session.
Do not publish authenticated UI or perform actions for a newly selected account until its sign-in succeeds.

| Error code | Meaning |
| --- | --- |
| `INVALID_REQUEST` | Invalid local token or endpoint configuration. |
| `EXCHANGE_NOT_ENABLED` | External Entra exchange is disabled for the project. |
| `AUTH_FAILED` | The Entra token was rejected; check audience, tenant, scope, and expiry. |
| `INSUFFICIENT_PERMISSIONS` | The user lacks Execute permission on the item. |
| `NOT_AVAILABLE` | The endpoint is unavailable in the target environment or the URL is wrong. |
| `TOKEN_EXCHANGE_FAILED` | A network or other HTTP failure prevented the exchange. |
| `INVALID_TOKEN_RESPONSE` | The service returned an invalid token response. |

The exchange does not follow redirects or automatically retry session issuance.
Errors do not include the Entra token or raw server response.
In browsers, the service must allow your origin and authorization header through its CORS policy.
The direct helper does not require a user gesture, but your identity library may require one when obtaining the Entra token interactively.
