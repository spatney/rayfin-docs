---
sidebar_position: 50
---

# Deep linking and shareable URLs

Deep linking lets a user copy the browser URL and send someone the exact view they were looking at.

A Fabric data app runs inside a cross-origin iframe and has no addressable URL of its own, so it cannot write to the address bar directly.
The `@microsoft/rayfin-app-state-fabric` package bridges that gap: your app hands the portal a plain JSON object, and the portal encodes it into the URL it owns.

## Availability

Deep linking is rolling out per tenant, so it is not available everywhere yet.

Always call `isSupported()` before showing a share button or any affordance that depends on the URL carrying state.
It resolves to `undefined` when the host does not support deep linking, and your app should continue to work normally in that case.

## How it works

1. A user opens a link whose portal URL carries encoded state.
2. The portal seeds that state onto your app's iframe URL before your app loads.
3. Your app reads it synchronously on startup, so the shared view renders first and no default view flashes.
4. As the user navigates, your app writes state back through the SDK and the portal updates its address bar.
5. When the user presses Back or Forward, the portal notifies your app so it can restore the matching view.

The portal owns encoding, versioning, size limits, and browser history.
Your app owns the shape of the state object.

## Install the package

```bash
npm install @microsoft/rayfin-app-state-fabric
```

If your project uses prerelease Rayfin packages, install the same exact version of `@microsoft/rayfin-app-state-fabric` as the other `@microsoft/rayfin-*` packages in the project.

## Create the client

Create one client for the lifetime of your app and share it, rather than constructing one per component.

```typescript
import { createFabricAppStateClient } from '@microsoft/rayfin-app-state-fabric';

const appState = createFabricAppStateClient();
```

Leave `targetOrigin` unset.
The parent window is a Fabric extension host, not the portal origin shown in the address bar, and its origin varies by environment.
Pinning the portal origin makes the browser silently discard every message.
When `targetOrigin` is omitted, messages are posted with `"*"` and inbound events are not origin-checked.

## Read launch state before first render

Read the launch state before your first render so a default view never flashes before the shared one.

```typescript
const launch = appState.getLaunchStateSync();
renderApp(launch ?? defaultView);
```

`getLaunchStateSync()` returns the state without awaiting, which is what you want on the first render path.
It returns `undefined` when the URL carries no state, which is the normal case for a fresh navigation.

Use `await appState.getLaunchState()` when your startup code can be asynchronous.
It resolves from the seeded URL on hosts that support it, so awaiting it does not delay first paint.

Treat launch state as untrusted input.
Anyone can edit a link before sharing it, so validate it exactly as you would a query parameter before using it to drive queries.

## Keep the restored route through sign-in

A Rayfin app is authenticated, and its route guard sends a signed-out visitor to the sign-in route.
That redirect runs after the launch state has been restored, so a guard that does not carry the requested route forward replaces it, and the visitor lands on the default page.

This is the normal path for a shared link, because the recipient is usually not signed in yet.

Capture the requested route when you redirect to the sign-in route, then return to it after sign-in.

```tsx
if (requireAuth && !isAuthenticated) {
  const redirectState: AuthRedirectState = {
    from: `${location.pathname}${location.search}`,
  };
  return <Navigate to="/auth" replace state={redirectState} />;
}

if (!requireAuth && isAuthenticated) {
  return <Navigate to={resolveReturnPath(location.state)} replace />;
}
```

Validate the captured route before navigating back to it.
Accept only same-origin application paths, and reject the sign-in route itself so sign-in cannot loop.

Keeping the sign-in route out of the state you persist is not the same thing.
A shared link needs both: never write the sign-in route into deep-link state, and carry the requested route across the sign-in redirect.

Templates that ship a route guard already carry the requested route through sign-in, so preserve that behavior as you add routes.

## Write state as the user navigates

Choose between the two writers by asking who caused the change.

Use `setState()` when the *user* caused it, such as a click, a filter change, or opening a record.
It creates a history entry, so Back returns the user to where they were.

```typescript
await appState.setState({ view: 'sales', region: 'AT' });
```

Use `replaceState()` when the *app* caused it, or for high-frequency updates such as a slider drag where one history entry per update would make Back unusable.

```typescript
await appState.replaceState({ view: 'sales', threshold: value });
```

The whole object is replaced on every write.
There is no partial or namespaced update, so merge your state before writing it.

## React to Back and Forward

Subscribe to observe changes your app did not initiate, such as the browser Back and Forward buttons or a deep link opened in the current tab.

```typescript
const unsubscribe = appState.onStateChange((state) => {
  restore(state ?? defaultView);
});

// On teardown
unsubscribe();
appState.dispose();
```

The listener receives `undefined` when navigation reaches a URL that carries no state, which means your app should restore its own defaults.

## Check support before showing a share button

```typescript
const capabilities = await appState.isSupported();

if (capabilities) {
  showShareButton();

  // Some hosts can update the URL but cannot add history entries.
  if (!capabilities.canPush) {
    hideBackForwardHints();
  }
}
```

The host is authoritative.
It reports its own `maxEncodedBytes`, `maxDepth`, and `canPush`, and those values are the real contract.

## Running standalone

Many apps ship standalone as well as embedded.
Standalone, your app owns its own address bar and there is no host to talk to, so deep-link state is unavailable by design.

The client is safe to construct either way.
It never throws at construction and never rewrites a URL it does not own.

Use the same `isSupported()` check to select your standalone path:

```typescript
const capabilities = await appState.isSupported();

if (capabilities) {
  await appState.setState({ view: 'sales', region: 'AT' });
} else {
  router.push({ path: '/sales', query: { region: 'AT' } });
}
```

Standalone, reads return `undefined` and writes reject with `NO_HOST_WINDOW`.
Reads degrade quietly so startup needs no branching, while writes fail loudly so a missing branch shows up during development.

## Limits and rules

- State must be a plain JSON object. `Date`, `Map`, `Set`, class instances, functions, and `undefined` are rejected rather than silently degraded.
- State is capped at 4 KiB encoded and 20 levels deep, so shared links survive corporate proxies, mail gateways, and chat clients.
- For anything larger, store the data yourself and put an identifier in the state.
- The encoding is versioned but your payload is not, so a link shared before a shape change still arrives in the old shape and your app must tolerate it.

## Security

State travels in a URL, so treat it accordingly.

**It is visible to the user.**
It appears in the address bar, browser history, bookmarks, screenshots, copied links, and corporate proxy logs.
Never put secrets, access tokens, or personal data in it.
When the state is sensitive, use an opaque identifier that maps to server-side data.

**It is untrusted input.**
Validate launch state before using it, and tolerate state written by a different version of your own app.

## Troubleshooting

**`isSupported()` resolves to `undefined`.**
Either the app is not embedded in the Fabric portal, or deep linking has not reached this tenant yet.
Both are expected, and your app should fall back to its own routing.
Also check that the client does not set `targetOrigin`; pinning the portal origin silently prevents communication with the Fabric extension host.

**A shared link opens the default page instead of the shared view.**
The app restored the launch state and then replaced it.
Check the sign-in redirect first, because the recipient of a shared link is usually signed out.
See [Keep the restored route through sign-in](#keep-the-restored-route-through-sign-in).

**Writes reject with `STATE_TOO_LARGE`.**
The state exceeds the encoded budget the host reported.
Move the bulk of the data server-side and keep an identifier in the state.

**Writes reject with `INVALID_STATE`.**
The state contains something JSON cannot round-trip, such as a `Date`, a class instance, `undefined`, or a circular reference.
The error message names the offending path.

**Writes reject with `NO_HOST_WINDOW`.**
The app is not running embedded, so there is no portal to write to.

Errors are `FabricAppStateError` values with a stable `code`.
Branch on the code, never on the message.

## Next steps

- [Fabric Brokered Auth](../auth/fabric.md) — How Fabric SSO authentication works.
- [Deploy to Microsoft Fabric](./deploy.md) — Detailed deployment commands and troubleshooting.
