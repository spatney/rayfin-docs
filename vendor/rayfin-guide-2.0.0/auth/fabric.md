---
sidebar_position: 2
---

# Fabric Auth

Fabric authentication lets users sign in to your Rayfin application with their existing Microsoft Entra identity through the Fabric Portal.
No separate login form is needed — users authenticate once in Fabric and your app inherits that session automatically.

The SDK supports three modes:

- **Popup flow** — your app opens the Fabric Portal in a new browser tab, the user authenticates, and the tab closes automatically.
- **Embedded flow** — your app runs inside a Fabric iframe and inherits the session via `postMessage` with no popup, redirect, or user interaction.
- **Direct token flow** — your browser or Node.js app supplies an existing delegated Entra token and establishes a Rayfin session without a browser broker.
  See [Direct Entra token sign-in](./direct-entra-auth.md).

The popup and embedded flows use PKCE S256, `postMessage` origin validation, and state nonces.
The direct flow uses an HTTPS token exchange with delegated-token validation and item-level Execute permission checks.

> **Embedding outside Fabric?** If your app runs inside an iframe on your own third-party portal rather than the Fabric Portal, the portal brokers sign-in with its own Entra token via the parent-page [external embed host](./external-embed-host.md).
> On startup the embedded app posts a one-shot readiness signal and briefly waits for the parent to acknowledge it; if no external embed host answers, the app falls back to the standard Fabric login waterfall described below with no added user-visible delay.

## How it works

### Popup flow

1. Your app opens the Fabric Portal in a new browser tab and registers a `postMessage` listener.
2. The user authenticates through Entra ID inside the Fabric Portal.
3. The Fabric extension sends the handoff code back to your app via `window.top.opener.postMessage()`.
4. The SDK exchanges the handoff code for Rayfin session tokens and creates a session.
5. The Fabric tab is closed automatically.

No callback page or redirect is needed.

### Embedded flow (Fabric iframe)

1. The Fabric Shell loads your app inside an iframe with `?fabricEmbedded=true` in the URL.
2. On startup your app detects embedded mode and calls `initEmbeddedAuth()`.
3. The SDK generates PKCE parameters in memory and sends `auth.requestHandoff` to the parent frame via `postMessage`.
4. The Fabric Extension Host responds with a handoff code.
5. The SDK exchanges the handoff code for Rayfin session tokens and creates a session.

No popup, redirect, or user click is needed.

## Enable Fabric auth

Add the `fabric` section and your app's origin to `rayfin/rayfin.yml`:

```yaml
services:
  auth:
    enabled: true
    allowedRedirectUris:
      - http://localhost:5173
    fabric:
      enabled: true
```

The `allowedRedirectUris` list must include your app's bare origin (e.g. `http://localhost:5173`).
The Fabric brokered auth flow uses the origin as the `postMessage` target for the handoff code.

After changing `rayfin.yml`, redeploy the backend:

```bash
npx rayfin up
```

For a remote deployment, re-deploy to push the updated settings:

```bash
npx rayfin up
```

## Install the provider package

The Fabric auth provider is a separate companion package:

```bash
npm install @microsoft/rayfin-auth-provider-fabric
```

## Client-side usage

### Popup flow: sign in with a button click

Call `ensureSignedInWithFabric` from a user-gesture handler (for example, a button click).
Step 4 of the waterfall calls `window.open()`, so a user gesture is required to avoid popup blockers.

```typescript
import { RayfinClient } from "@microsoft/rayfin-client";
import { browserSession } from "@microsoft/rayfin-auth";
import { ensureSignedInWithFabric } from "@microsoft/rayfin-auth-provider-fabric";

const client = RayfinClient.create({
  baseUrl: "http://localhost:5168",
  publishableKey: "pk-commonSampleAppKey",
  auth: browserSession(),
});

async function handleSignIn() {
  try {
    const session = await ensureSignedInWithFabric(client.auth, {
      workspaceId: "<your-fabric-workspace-id>",
      projectId: "<your-rayfin-item-id>",
      fabricPortalUrl: "https://app.fabric.microsoft.com",
      returnOrigin: window.location.origin,
    });
    console.log("Signed in:", session.user);
  } catch (error) {
    // Always show the user-safe message in your sign-in UI.
    showSignInError(error instanceof Error ? error.message : "Sign-in failed.");
  }
}
```

`showSignInError` stands for whatever your app uses to render the message, such as React state.
See [Error handling](#error-handling) for the error codes you may receive.

### Embedded flow: automatic authentication on startup

Call `initEmbeddedAuth()` once at app startup (for example, in a React `useEffect` or initialization routine).
Await it before restoring a stored user or rendering authenticated content, even when a persisted session exists.
It is safe to call on every page load: standalone pages return `null` immediately, while framed pages briefly wait for an external embed acknowledgement before choosing the login path.
Keep session-change observers from publishing a stored user while initialization is pending.

```typescript
import { RayfinClient } from "@microsoft/rayfin-client";
import { browserSession } from "@microsoft/rayfin-auth";
import { initEmbeddedAuth } from "@microsoft/rayfin-auth-provider-fabric";

const client = RayfinClient.create({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
  auth: browserSession(),
});

const fabricOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID,
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  returnOrigin: window.location.origin,
};

// Safe to call on every page load — no-op when not embedded.
// Best-effort: resolves to null (it does not reject) when embedded sign-in fails.
const session = await initEmbeddedAuth(client.auth, fabricOptions);
if (session) {
  console.log("Embedded session established:", session.user);
} else {
  // Show the sign-in button; ensureSignedInWithFabric() reports any error on click.
  showSignInButton();
}
```

`initEmbeddedAuth()` is a best-effort initializer.
When embedded sign-in fails (for example, `ACCESS_DENIED` or `BRIDGE_TIMEOUT`), it logs a console warning and resolves to `null` instead of rejecting.
To show the reason, render the sign-in button; clicking it calls `ensureSignedInWithFabric()`, which retries the embedded handoff and rejects with the error.

Import `@microsoft/rayfin-auth-provider-fabric` statically in your app entry module rather than only via dynamic `import()`.
The package captures the `?fabricEmbedded=true` URL flag into `sessionStorage` as a side effect at module load, and that must happen on the initial page load before any client-side navigation strips the query string (for example, a post-logout redirect to `/login`).
Do not condition the startup call on the absence of a stored session; that bypasses the SDK's identity check and external embed handshake.

### Detecting embedded mode

The SDK detects embedded mode when any of these conditions is true:

- The `fabricEmbedded` option is set to `true` in `FabricAuthOptions`.
- The URL contains the `?fabricEmbedded=true` query parameter.
- A previous call already stored the flag in `sessionStorage`.

These Fabric hints are checked before external-host discovery.
When any is present, the SDK uses Fabric authentication without sending `externalEmbed.ready` or waiting for its 300 ms timeout.
Otherwise, an iframe can discover an [external embed host](./external-embed-host.md) before session resume; a standalone page does not send a discovery message.
External hosts must not set or retain the Fabric embedded flag.

You can check this manually:

```typescript
import { isEmbeddedMode } from "@microsoft/rayfin-auth-provider-fabric";

const embedded = isEmbeddedMode({
  workspaceId: "...",
  projectId: "...",
  fabricPortalUrl: "...",
  returnOrigin: window.location.origin,
});
```

### Supporting both flows

Most apps should support both embedded mode (iframe) and the popup flow (standalone browser).
`ensureSignedInWithFabric()` handles this automatically — it tries embedded auth first, then falls back to the popup:

1. Return existing session if already authenticated.
2. Attempt refresh via refresh token.
3. If embedded mode is detected, use `postMessage` handoff (no popup).
4. Otherwise, open the Fabric Portal in a new tab and wait for the handoff.

For page-load initialization (no user gesture), use `initEmbeddedAuth()` instead.
It skips step 4 and returns `null` when no embedded session is available, including when embedded sign-in fails.

### React hook example

The hook below runs best-effort embedded sign-in on load, exposes a click handler that signs in and reports errors, and stores any sign-in error so the login screen can render it.

```typescript
import { useCallback, useEffect, useState } from "react";
import {
  ensureSignedInWithFabric,
  initEmbeddedAuth,
} from "@microsoft/rayfin-auth-provider-fabric";
import { client } from "./lib/rayfin";

const fabricOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID,
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  returnOrigin: window.location.origin,
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sign-in failed.";
}

export function useFabricAuth() {
  const [session, setSession] = useState(client.auth.getSession());
  const [error, setError] = useState<string | null>(null);

  // On load: best-effort embedded sign-in. Resolves to null on failure; the
  // click handler below reports the error. Always re-read the session: an
  // embedded host may discard a restored session before the handoff.
  useEffect(() => {
    initEmbeddedAuth(client.auth, fabricOptions).then(() => {
      setSession(client.auth.getSession());
    });
  }, []);

  // On click: embedded handoff or popup sign-in. Rejects with the error.
  const signIn = useCallback(async () => {
    setError(null);
    try {
      const result = await ensureSignedInWithFabric(client.auth, fabricOptions);
      setSession(result);
      return result;
    } catch (err) {
      setError(toMessage(err));
      return null;
    }
  }, []);

  return {
    session,
    signIn,
    error,
    isAuthenticated: session?.isAuthenticated ?? false,
  };
}
```

Render `error` on your login screen, for example `{error && <p role="alert">{error}</p>}`.

## Error handling

`ensureSignedInWithFabric()` rejects with an `AuthError` from `@microsoft/rayfin-lib` when sign-in fails, whether it runs on page load or on button click.
`initEmbeddedAuth()` is the exception: it is best-effort and resolves to `null` instead of rejecting, so the error surfaces when the user clicks sign in.
`error.message` is a user-safe, localized description intended to be displayed.
Apps **must** catch errors from every sign-in call that can reject, and show `error.message` in the sign-in UI.
Never swallow a sign-in error with an empty `catch` or by only resetting the user to signed out.
Use `error.code` only for branching logic or telemetry.

| Code                       | Meaning                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `ACCESS_DENIED`            | The signed-in user does not have access to this app.                                   |
| `TOKEN_ACQUISITION_FAILED` | The broker could not acquire a Fabric token for the user.                              |
| `AUTHORIZE_FAILED`         | The broker's authorize step failed (server, network, or unexpected error).             |
| `AUTH_FAILED`              | Authentication failed in the broker.                                                   |
| `INVALID_CALLBACK_URL`     | The app's return origin or callback URL is not allowed.                                |
| `RATE_LIMITED`             | Too many sign-in requests from the embedded app. Wait and retry.                       |
| `OWNER_LOGIN_REQUIRED`     | Only the app owner can sign in while the app's Functions use delegated authentication. |
| `APP_DEPLOYMENT_REQUIRED`  | The app's Functions must be deployed or redeployed before users can sign in.           |
| `APP_ADMIN_BLOCKED`        | A tenant or capacity admin has blocked the app.                                        |
| `FABRIC_AUTH_FAILED`       | The broker reported a failure without a specific code.                                 |
| `FABRIC_AUTH_POPUP_CLOSED` | The user closed the sign-in window before sign-in completed.                           |
| `FABRIC_AUTH_TIMEOUT`      | The broker did not complete the handoff within five minutes.                           |
| `TAB_BLOCKED`              | The browser blocked the sign-in popup.                                                 |
| `NO_PARENT_WINDOW`         | Embedded sign-in ran without an iframe host.                                           |
| `BRIDGE_TIMEOUT`           | The embedded host did not respond to the handoff request.                              |
| `STATE_MISMATCH`           | The handoff response did not match the request.                                        |

Broker and embedded host codes are passed through unchanged, so new codes may appear over time.
Treat unknown codes as a generic failure and still display `error.message`.
For the full list, see the `@microsoft/rayfin-auth-provider-fabric` package docs.

## API reference

### ensureSignedInWithFabric

```typescript
function ensureSignedInWithFabric(
  auth: Auth,
  options: FabricAuthOptions,
): Promise<OpaqueSession>;
```

The primary API.
Implements a four-step waterfall where the first successful step short-circuits the rest:

The SDK first selects Fabric embedding from its hints, or performs external-host discovery when those hints are absent.
External embedding skips session resume; Fabric embedding without a viewer hint also skips resume until a handoff completes in the current page load.

1. **Already authenticated** — returns the existing session when resume is permitted.
2. **Refresh token** — attempts to refresh the session silently when resume is permitted.
3. **Embedded mode** — for Fabric embedding or an acknowledged external host, uses `postMessage` to acquire a session without a popup.
4. **Open Fabric broker** — opens the Fabric Portal in a new tab, listens for the handoff code via `postMessage`, exchanges the code for tokens, and creates a session.

Steps 1–3 are safe to call on page load.
Step 4 opens a new browser tab and must run inside a user-gesture handler.

### initEmbeddedAuth

```typescript
function initEmbeddedAuth(
  auth: Auth,
  options: FabricAuthOptions,
): Promise<OpaqueSession | null>;
```

Call once at app startup.
Returns the authenticated session when running in embedded mode, or `null` when not embedded.
Best-effort: when embedded sign-in fails, it logs a warning and returns `null` instead of rejecting.
Never opens a popup or new tab — safe for page-load use.

**Waterfall:**

1. Return existing session if authenticated.
2. Attempt refresh via refresh token.
3. Request handoff from the parent frame via `postMessage` and exchange for tokens.

### initiateFabricLogin

```typescript
function initiateFabricLogin(
  auth: Auth,
  options: FabricAuthOptions,
): Promise<void>;
```

Low-level function that opens the Fabric Portal and listens for the postMessage handoff.
Called internally by `ensureSignedInWithFabric` in step 4.
Most apps should use `ensureSignedInWithFabric` instead.

### FabricAuthOptions

| Property          | Type                 | Description                                                                                                          |
| ----------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `workspaceId`     | `string`             | The Fabric workspace ID.                                                                                             |
| `projectId`       | `string`             | The Rayfin item ID (AppBackend artifact ID).                                                                         |
| `fabricPortalUrl` | `string`             | The Fabric Portal base URL (for example, `https://app.fabric.microsoft.com`).                                        |
| `returnOrigin`    | `string`             | Your app's origin (for example, `window.location.origin`). Used as the `postMessage` target origin.                  |
| `fabricEmbedded`  | `boolean` (optional) | When `true`, force embedded mode. The SDK also auto-detects embedded mode when `?fabricEmbedded=true` is in the URL. |

## Security

- **PKCE S256** — The popup and embedded flows generate a cryptographic code verifier and challenge to prevent authorization code interception.
- **State nonce** — A random nonce ties the postMessage response to the originating flow, preventing CSRF.
- **In-closure code verifier** — The PKCE `code_verifier` is held in memory (closure) and never persisted to localStorage.
- **Origin validation** — The SDK validates `event.origin` on incoming messages against `fabricPortalUrl`.
  The Fabric extension uses an explicit `targetOrigin` (not `"*"`) when sending the handoff code.
- **Flow timeout** — The flow times out after 5 minutes if no postMessage is received.
  If the user closes the sign-in popup, the flow rejects with `FABRIC_AUTH_POPUP_CLOSED` about one second later.
- **Session isolation** — In embedded mode, the iframe's `localStorage` stores the session tokens, isolated from the parent frame by the browser's same-origin policy.

## Environment variables

Fabric auth requires three Vite environment variables so your frontend can build the `FabricAuthOptions` at runtime.
`npx rayfin dev` writes the underlying `RAYFIN_PUBLIC_*` values to `rayfin/.env` and maps them to Vite-compatible names in `.env.local` before starting the frontend.
Production builds retain the scaffolded `prebuild` hook to refresh those values before bundling.

| Source variable (`rayfin/.env`) | Vite variable (`.env.local`) | Description                                                            | Example                                |
| ------------------------------- | ---------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `RAYFIN_PUBLIC_ITEM_ID`         | `VITE_FABRIC_ITEM_ID`        | The Fabric item ID (Fabric data app artifact ID). Maps to `projectId`. | `21b98705-08d5-448c-ab32-d88a3d00af41` |
| `RAYFIN_PUBLIC_WORKSPACE_ID`    | `VITE_FABRIC_WORKSPACE_ID`   | The Fabric workspace ID. Maps to `workspaceId`.                        | `b80c0e39-468a-4742-8f0a-458dc6b1c918` |
| `RAYFIN_PUBLIC_PORTAL_URL`      | `VITE_FABRIC_PORTAL_URL`     | The Fabric Portal base URL. Maps to `fabricPortalUrl`.                 | `https://app.fabric.microsoft.com/`    |

For local development, add these to `rayfin/.env`:

```text
RAYFIN_PUBLIC_ITEM_ID=<your-rayfin-item-id>
RAYFIN_PUBLIC_WORKSPACE_ID=<your-fabric-workspace-id>
RAYFIN_PUBLIC_PORTAL_URL=https://app.fabric.microsoft.com/
```

Then read them in your application code:

```typescript
const fabricOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID,
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  returnOrigin: window.location.origin,
};
```

## Deployment values

After running `npx rayfin dev` or `npx rayfin up`, the CLI records deployment metadata in `rayfin/.deployments.json` and merges the corresponding `RAYFIN_PUBLIC_*` variables into `rayfin/.env`:

```text
RAYFIN_PUBLIC_ITEM_ID=<guid>
RAYFIN_PUBLIC_WORKSPACE_ID=<guid>
RAYFIN_PUBLIC_PORTAL_URL=https://app.fabric.microsoft.com/
```

`rayfin dev` generates `.env.local` with Vite-compatible names before starting the frontend.
Use `RAYFIN_PUBLIC_ITEM_ID` as the `projectId` and `RAYFIN_PUBLIC_WORKSPACE_ID` as the `workspaceId` in your `FabricAuthOptions`.

## Troubleshooting

- **Popup blocked** — Call `ensureSignedInWithFabric` from a synchronous user-gesture handler (for example, a button `onClick`).
  Calling it on page load or inside an `async` chain before the user clicks triggers popup blockers.
- **Session not persisting** — Confirm the `RayfinClient` is configured with the correct `baseUrl` and `publishableKey`.
- **Sign-in fails with no visible message** — Your app is discarding the error.
  Catch errors from `ensureSignedInWithFabric()` and render `error.message` on the login screen.
  `initEmbeddedAuth()` does not reject; when it returns `null`, show the sign-in button so the click reports the error.
- **Timeout after 5 minutes** — The handoff code was not received.
  Check that `returnOrigin` matches your app's actual origin and that the Fabric extension is sending to the correct origin.
- **Origin mismatch** — The `fabricPortalUrl` origin must match the origin of the Fabric Portal tab.
  Verify you are using the correct URL for your environment (production, PPE, or dev).
- **`initEmbeddedAuth` returns `null`** — Ensure the URL contains `?fabricEmbedded=true` or set `fabricEmbedded: true` in the options.
  It also returns `null` when embedded sign-in fails; check the console warning, or click sign in to see the error.
- **Embedded handoff timeout** — The parent frame did not respond.
  Verify that `returnOrigin` matches the iframe's actual origin.
- **State mismatch error** — The response state did not match the request.
  This can indicate a replay attack or a stale response from a previous flow.
