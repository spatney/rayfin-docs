# Fabric auth provider

Fabric brokered authentication helpers for Rayfin applications.

Use `@microsoft/rayfin-auth-provider-fabric` to sign in through a Fabric-hosted browser experience or exchange an existing delegated Entra token directly for a Rayfin session.

Popup and iframe helpers require a browser.
`signInWithEntraToken()` supports browsers and Node.js and installs the exchanged session on your existing `Auth` instance.

## Installation

```bash
npm install @microsoft/rayfin-auth-provider-fabric @microsoft/rayfin-auth @microsoft/rayfin-lib
```

## Direct Entra token sign-in

Use this flow when your app already obtains a delegated Entra token through MSAL, Azure CLI, or another identity library.
Token acquisition remains your responsibility.
The token must target the Fabric/Power BI resource accepted by your deployment, contain delegated `Item.Execute.All`, and belong to the target item's owning tenant.
The user must also have Execute permission on that item; app-only tokens are not supported.
The app must have external Entra exchange enabled.

```typescript
import { Auth } from "@microsoft/rayfin-auth";
import { ApiClient } from "@microsoft/rayfin-lib";
import { signInWithEntraToken } from "@microsoft/rayfin-auth-provider-fabric";

const apiClient = new ApiClient({
  baseUrl: rayfinEndpoint,
  publishableKey,
});
const auth = new Auth(apiClient, { storage: false });
auth.attachToClient(apiClient);

try {
  const session = await signInWithEntraToken(auth, { entraToken });
  console.log("Authenticated", session.isAuthenticated);
  // Use SDK clients attached to apiClient here.
} finally {
  auth.destroy();
}
```

This example works in Node.js without browser globals.
`rayfinEndpoint` is the trusted HTTPS AppBackend workload API base URL, including its existing path, not the app's static-hosting URL or a full token endpoint.
Use an absolute HTTPS URL, including for localhost, with no credentials, query string, or fragment; relative proxy bases are not supported.
`entraToken` is the raw token string, without the `Bearer` scheme prefix.
The SDK resolves `/api/auth/v1/brokered/token` against the configured base.
No `FabricAuthOptions`, popup, iframe, PKCE, or return origin is needed.

```typescript
function signInWithEntraToken(
  auth: Auth,
  options: EntraTokenSignInOptions,
): Promise<OpaqueSession>;

interface EntraTokenSignInOptions {
  entraToken: string;
}
```

For a client composed with `browserSession`, pass `client.auth`; it is already attached to the client's HTTP transport.
The returned `OpaqueSession` exposes session metadata, not tokens.
Subsequent authenticated requests and refresh use the Rayfin session, not the Entra token.
The supplied `Auth` instance controls persistence; `storage: false` keeps the session in memory.
Use a separate instance per user on a server and call `auth.destroy()` when it is no longer needed.
A supplied-token client does not expose `auth`; this helper expects a standalone `Auth` or a browser-session client's `auth`, not an access-token callback.

Each explicit call attempts an exchange rather than silently returning a previous session.
Concurrent direct calls on the same `Auth` instance run in invocation order and coordinate with its refresh operations.
Success persists and replaces the session before emitting the login event; failure preserves an existing unexpired in-memory session without treating it as a successful new sign-in.
The helper does not revoke the previous server session.
Failures reject with `AuthError`; do not treat a failed sign-in as authentication of the requested identity.
Browser callers need the service's CORS policy to permit the calling origin and authorization header.
The helper does not acquire Entra tokens, follow exchange redirects, or automatically retry a rejected exchange.

## Browser quick start

For the browser broker experience, the recommended entry point is `ensureSignedInWithFabric()`.

It performs a three-step waterfall:

1. Return the current session if the user is already authenticated.
2. Attempt `auth.refreshSession()` when a refresh token exists.
3. Open the Fabric broker in a popup and complete the handoff flow.

Call it from a synchronous user gesture, such as a button click, because the broker step uses `window.open()`.

The example below reads its configuration from the Vite-projected environment variables the Rayfin CLI emits.
`rayfin up` writes `RAYFIN_PUBLIC_*` values to `rayfin/.env` and, when it detects a Vite or Next.js project, automatically projects them into `.env.local` as the `VITE_*` (or `NEXT_PUBLIC_*`) names shown here.
Run `rayfin env --framework <vite|nextjs|plain>` manually only if you need to regenerate `.env.local` outside those flows or target a framework that can't be auto-detected.

```typescript
import { ApiClient } from "@microsoft/rayfin-lib";
import { Auth } from "@microsoft/rayfin-auth";
import { ensureSignedInWithFabric } from "@microsoft/rayfin-auth-provider-fabric";

const apiClient = new ApiClient({
  baseUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
});

const auth = new Auth(apiClient);

const fabricOptions = {
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  projectId: import.meta.env.VITE_FABRIC_ITEM_ID,
  fabricPortalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
  returnOrigin: window.location.origin,
};

const signInError = document.querySelector("#sign-in-error");

document.querySelector("#sign-in")?.addEventListener("click", async () => {
  if (signInError) signInError.textContent = "";
  try {
    const session = await ensureSignedInWithFabric(auth, fabricOptions);
    console.log("Authenticated", session.isAuthenticated);
  } catch (error) {
    // Show the user-safe message in the sign-in UI; never swallow it.
    if (signInError) {
      signInError.textContent =
        error instanceof Error ? error.message : "Sign-in failed.";
    }
  }
});
```

Always catch sign-in errors and display `error.message` to the user.
See [Error handling](#error-handling) for the codes you may receive.

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

Use `signInWithEntraToken()` when your app already has a delegated Entra token and wants to sign in without a browser broker.

Use `ensureSignedInWithFabric()` when you want silent-session and refresh-token fallback behavior before opening the broker UI.

Use `initiateFabricLogin()` when you only want the broker step and do not need the session and refresh pre-checks.

```typescript
import { initiateFabricLogin } from "@microsoft/rayfin-auth-provider-fabric";

await initiateFabricLogin(auth, {
  workspaceId: "00000000-0000-0000-0000-000000000000",
  projectId: "11111111-1111-1111-1111-111111111111",
  fabricPortalUrl: "https://app.fabric.microsoft.com",
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
import { bridgeFabricCallback } from "@microsoft/rayfin-auth-provider-fabric";

const bridged = bridgeFabricCallback();

if (!bridged) {
  console.log("No Fabric handoff detected");
}
```

The bridge returns `true` when it handled a Fabric handoff and `false` when the current URL is unrelated.

## Behavior notes

- The browser broker URL is built with PKCE using the `S256` challenge method; direct token sign-in does not use PKCE.
- Existing query parameters on `fabricPortalUrl` are preserved.
- `callbackUrl` defaults to `${returnOrigin}/auth/callback` when omitted.
- The broker handoff waits up to five minutes before timing out.
- If the user closes the sign-in popup before it completes, the call rejects with `FABRIC_AUTH_POPUP_CLOSED` about one second later instead of waiting for the timeout.
- If `window.opener` is unavailable in legacy flows, the bridge falls back to `BroadcastChannel`.

## Error handling

The package throws `AuthError` values from `@microsoft/rayfin-lib` for validation and broker failures.

Common cases include missing required options, blocked popups, explicit broker errors, a closed sign-in window, and handoff timeout.

`error.message` is a user-safe, localized description intended to be displayed.
Apps **must** catch errors from every sign-in call that can reject (`ensureSignedInWithFabric()`, whether on page load or on button click) and show `error.message` in the sign-in UI.
`initEmbeddedAuth()` is best-effort: when embedded sign-in fails it logs a warning and resolves to `null` instead of rejecting, so show the sign-in button and let the click report the error.
Do not swallow sign-in errors with an empty `catch` or by only resetting the user to signed out; otherwise users see no reason why they cannot sign in.
Use `error.code` only for branching logic or telemetry.

### Broker and popup error codes

| Code                                                                                               | Meaning                                                                                |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ACCESS_DENIED`                                                                                    | The signed-in user does not have access to this app.                                   |
| `TOKEN_ACQUISITION_FAILED`                                                                         | The broker could not acquire a Fabric token for the user.                              |
| `AUTHORIZE_FAILED`                                                                                 | The broker's authorize step failed (server, network, or unexpected error).             |
| `AUTH_FAILED`                                                                                      | Authentication failed in the broker.                                                   |
| `INVALID_CALLBACK_URL`                                                                             | The app's return origin or callback URL is not allowed.                                |
| `RATE_LIMITED`                                                                                     | Too many sign-in requests from the embedded app. Wait and retry.                       |
| `OWNER_LOGIN_REQUIRED`                                                                             | Only the app owner can sign in while the app's Functions use delegated authentication. |
| `APP_DEPLOYMENT_REQUIRED`                                                                          | The app's Functions must be deployed or redeployed before users can sign in.           |
| `APP_ADMIN_BLOCKED`                                                                                | A tenant or capacity admin has blocked the app.                                        |
| `FABRIC_AUTH_FAILED`                                                                               | The broker reported a failure without a specific code.                                 |
| `FABRIC_AUTH_POPUP_CLOSED`                                                                         | The user closed the sign-in window before sign-in completed.                           |
| `FABRIC_AUTH_TIMEOUT`                                                                              | The broker did not complete the handoff within five minutes.                           |
| `TAB_BLOCKED`                                                                                      | The browser blocked the sign-in popup.                                                 |
| `PKCE_CHALLENGE_FAILED`                                                                            | The SDK could not prepare the PKCE challenge.                                          |
| `CHALLENGE_DELIVERY_FAILED`                                                                        | The SDK could not deliver the PKCE challenge to the broker.                            |
| `MISSING_WORKSPACE_ID`, `MISSING_PROJECT_ID`, `MISSING_RETURN_ORIGIN`, `MISSING_FABRIC_PORTAL_URL` | A required `FabricAuthOptions` value is missing.                                       |

Broker codes such as `ACCESS_DENIED` are passed through from the Fabric broker, so new codes may appear over time.
Treat unknown codes as a generic failure and still display `error.message`.

### Embedded error codes

In embedded mode, the host responds to the handoff request and its error code and message are passed through unchanged.
SDK-originated embedded codes include `NO_PARENT_WINDOW` (no iframe host), `BRIDGE_TIMEOUT` (the host did not respond), `STATE_MISMATCH`, and `SESSION_NOT_ESTABLISHED`.

### Direct token sign-in error codes

Direct token sign-in reports `INVALID_REQUEST` for invalid local inputs, `EXCHANGE_NOT_ENABLED` for a disabled exchange, `AUTH_FAILED` for token rejection, `INSUFFICIENT_PERMISSIONS` for missing Execute access, and `NOT_AVAILABLE` for an unavailable endpoint.
Transport or other HTTP failures use `TOKEN_EXCHANGE_FAILED`; malformed successful responses use `INVALID_TOKEN_RESPONSE`.
Errors do not include the supplied token or raw server response.

### Displaying sign-in errors

The React example below runs best-effort embedded sign-in on load and the interactive sign-in on button click, and renders the error message when sign-in fails.

```tsx
import { useEffect, useState } from "react";
import { AuthError } from "@microsoft/rayfin-lib";
import {
  ensureSignedInWithFabric,
  initEmbeddedAuth,
} from "@microsoft/rayfin-auth-provider-fabric";

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Sign-in failed.";
}

export function SignIn() {
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On load: best-effort embedded sign-in (no popup). Resolves to null on
  // failure; the click handler below reports the error. Always re-read the
  // session: standalone pages keep a restored session, while an embedded host
  // may discard it before the handoff.
  useEffect(() => {
    initEmbeddedAuth(auth, fabricOptions).then(() =>
      setSignedIn(auth.getSession().isAuthenticated),
    );
  }, []);

  // On click: embedded handoff or popup sign-in (must run in the click handler).
  async function handleSignIn() {
    setError(null);
    try {
      const session = await ensureSignedInWithFabric(auth, fabricOptions);
      setSignedIn(session.isAuthenticated);
    } catch (err) {
      if (err instanceof AuthError) console.warn(err.code);
      setError(toMessage(err));
    }
  }

  if (signedIn) return <p>Signed in</p>;
  return (
    <div>
      <button onClick={handleSignIn}>Sign in with Fabric</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

## Runtime requirements

The public package entry point and `signInWithEntraToken()` can be imported and used in Node.js without browser globals.
Use memory-only or appropriate custom `Auth` storage outside a browser.

The popup, iframe, and legacy callback helpers remain browser-only.
They depend on browser APIs such as `window.open()`, `postMessage`, `BroadcastChannel`, and `window.location`.
