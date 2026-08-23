# Fabric auth provider

Fabric brokered authentication helpers for Rayfin browser applications.

Use `@microsoft/rayfin-auth-provider-fabric` when your application needs to authenticate through a Fabric-hosted broker experience instead of calling the standard Rayfin auth flows directly.

The package is designed for browser applications that already use `@microsoft/rayfin-auth` and need to reuse an existing session, refresh an expired session, or open the Fabric broker when no session can be restored silently.

## Installation

```bash
npm install @microsoft/rayfin-auth-provider-fabric @microsoft/rayfin-auth @microsoft/rayfin-lib
```

## Quick start

The recommended entry point is `ensureSignedInWithFabric()`.

It performs a three-step waterfall:

1. Return the current session if the user is already authenticated.
2. Attempt `auth.refreshSession()` when a refresh token exists.
3. Open the Fabric broker in a popup and complete the handoff flow.

Call it from a synchronous user gesture, such as a button click, because the broker step uses `window.open()`.

```typescript
import { ApiClient } from '@microsoft/rayfin-lib';
import { Auth } from '@microsoft/rayfin-auth';
import { ensureSignedInWithFabric } from '@microsoft/rayfin-auth-provider-fabric';

const apiClient = new ApiClient({
  baseUrl: 'https://api.contoso.example',
  publishableKey: 'pk_your_publishable_key',
});

const auth = new Auth(apiClient);

const fabricOptions = {
  workspaceId: '00000000-0000-0000-0000-000000000000',
  projectId: '11111111-1111-1111-1111-111111111111',
  fabricPortalUrl: 'https://app.fabric.microsoft.com',
  returnOrigin: window.location.origin,
};

document.querySelector('#sign-in')?.addEventListener('click', async () => {
  const session = await ensureSignedInWithFabric(auth, fabricOptions);
  console.log('Authenticated', session.isAuthenticated);
});
```

## Options

`FabricAuthOptions` controls how the broker URL is constructed and how the handoff is returned to your app.

```typescript
interface FabricAuthOptions {
  workspaceId: string;
  projectId: string;
  fabricPortalUrl: string;
  returnOrigin: string;
  callbackUrl?: string;
}
```

`fabricPortalUrl` preserves existing paths and query parameters.

This supports production and development portal URLs such as `https://app.fabric.microsoft.com` or `https://powerbi-df.analysis-df.windows.net?debug.useLocalManifests=1&experience=power-bi`.

## Supported flows

Use `ensureSignedInWithFabric()` when you want silent-session and refresh-token fallback behavior before opening the broker UI.

Use `initiateFabricLogin()` when you only want the broker step and do not need the session and refresh pre-checks.

```typescript
import { initiateFabricLogin } from '@microsoft/rayfin-auth-provider-fabric';

await initiateFabricLogin(auth, {
  workspaceId: '00000000-0000-0000-0000-000000000000',
  projectId: '11111111-1111-1111-1111-111111111111',
  fabricPortalUrl: 'https://app.fabric.microsoft.com',
  returnOrigin: window.location.origin,
});
```

On success, the package exchanges the Fabric handoff code for tokens through the Rayfin auth API and creates the session on your `Auth` instance.

## Legacy callback bridge

Newer broker flows use `postMessage` to send the handoff code back to the opener window.

Older broker flows may redirect the popup to a callback page in your app instead.

For those older flows, call `bridgeFabricCallback()` as early as possible in the callback page.

If the URL contains Fabric handoff parameters, the function forwards them to the opener window and closes the popup.

```typescript
import { bridgeFabricCallback } from '@microsoft/rayfin-auth-provider-fabric';

const bridged = bridgeFabricCallback();

if (!bridged) {
  console.log('No Fabric handoff detected');
}
```

The bridge returns `true` when it handled a Fabric handoff and `false` when the current URL is unrelated.

## Behavior notes

- The broker URL is built with PKCE using the `S256` challenge method.
- Existing query parameters on `fabricPortalUrl` are preserved.
- `callbackUrl` defaults to `${returnOrigin}/auth/callback` when omitted.
- The broker handoff waits up to five minutes before timing out.
- If `window.opener` is unavailable in legacy flows, the bridge falls back to `BroadcastChannel`.

## Error handling

The package throws `AuthError` values from `@microsoft/rayfin-lib` for validation and broker failures.

Common cases include missing required options, blocked popups, explicit broker errors, and handoff timeout.

```typescript
import { AuthError } from '@microsoft/rayfin-lib';

try {
  await ensureSignedInWithFabric(auth, fabricOptions);
} catch (error) {
  if (error instanceof AuthError) {
    console.error(error.code, error.message);
  }
}
```

## Browser requirements

This package is intended for browser environments.

It depends on browser APIs such as `window.open()`, `postMessage`, `BroadcastChannel`, and `window.location`.
