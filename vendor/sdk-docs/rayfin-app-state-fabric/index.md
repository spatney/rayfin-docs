# Fabric deep-link app state

Shareable, bookmarkable URLs for Rayfin applications embedded in the Fabric portal.

A Fabric App runs inside an iframe and cannot touch the portal address bar directly.
`@microsoft/rayfin-app-state-fabric` bridges that gap: your app can read the state it was launched with and write state back, so a user can copy the browser URL and send someone the exact view they were looking at.

The package builds on the message bridge in `@microsoft/fabric-embedded-host`, which handles the underlying `postMessage` transport.

## Installation

```bash
npm install @microsoft/rayfin-app-state-fabric
```

## Quick start

Create one client for the lifetime of the app and read the launch state before your first render, so a default view never flashes before the real one appears.

```typescript
import { createFabricAppStateClient } from '@microsoft/rayfin-app-state-fabric';

const appState = createFabricAppStateClient();

const launch = appState.getLaunchStateSync();
renderApp(launch ?? defaultView);
```

Leave `targetOrigin` unset.
The embedding Fabric extension host does not share the portal origin shown in the address bar — the parent may be `https://dailypbiabd.powerbi.com` while the portal shows `https://daily.fabric.microsoft.com` — and it varies per environment.
Pinning a wrong value makes the browser discard every message, and the failure is silent: `isSupported()` resolves `undefined` and writes become no-ops.
When it is omitted, messages are posted with `"*"` and inbound events are not origin-checked.

## Reading launch state

Two readers are available, and which one you want depends on whether your code path can be asynchronous.

`getLaunchStateSync()` returns the seeded state without awaiting, which is what you want on the first render path.
It returns `undefined` when the host did not seed the URL.

`getLaunchState()` resolves synchronously from the seeded URL when the host supports it, and falls back to a bridge round trip only on hosts that do not seed.
Awaiting it does not delay first paint on a modern host.

```typescript
const launch = await appState.getLaunchState();
```

Both return `undefined` when the URL carries no state, which is the normal case for a fresh navigation.

## Writing state

Choose between the two writers by asking **who caused the change**.

Use `setState()` when the *user* caused it, such as a click, a filter change, or opening a record.
It creates a history entry, so Back returns the user to where they were.

```typescript
// The user picked a region: Back should undo it.
await appState.setState({ view: 'sales', region: 'AT' });
```

Use `replaceState()` when the *app* caused it, such as restoring, reconciling, or normalising state the user never asked for.
Also use it for high-frequency updates like a slider drag, where one history entry per update would make Back unusable.

```typescript
// Continuous updates while dragging: do not grow history.
await appState.replaceState({ view: 'sales', threshold: value });
```

The whole object is replaced on every write.
There is no partial or namespaced update, so an app with several independent pieces of state must merge them itself before writing.

### Platform caveat

The Fabric host downgrades a replace to a push when the previous history entry belongs to a different extension, which stops one extension from overwriting another's history.
The first `replaceState()` after a user arrives from elsewhere in Fabric may therefore still create an entry.
This is platform behaviour and cannot be overridden.

## Reacting to Back and Forward

Subscribe to observe changes the app did not initiate: browser Back or Forward, or a deep link opened in the current tab.

The listener receives `undefined` when navigation reaches a URL that carries no state, which means the app should restore its own defaults.

```typescript
const unsubscribe = appState.onStateChange((state) => {
  restore(state ?? defaultView);
});

// On teardown
unsubscribe();
appState.dispose();
```

## Checking host support

Deep linking rolls out per tenant, so check support before showing a share button rather than letting a user click one that cannot work.
The result is cached.

```typescript
const capabilities = await appState.isSupported();

if (capabilities) {
  showShareButton();

  // Some hosts can update the URL but not add history entries.
  if (!capabilities.canPush) {
    hideBackForwardHints();
  }
}
```

`isSupported()` resolves to `undefined` when the host does not implement deep-link state.
Otherwise it reports the host's `version`, `maxEncodedBytes`, `maxDepth`, and `canPush`.

The host is authoritative.
The client's own limits exist only to fail fast before a round trip, so treat the reported values as the real contract.

## Running outside the portal

Many apps ship standalone as well as embedded.
Standalone, the app owns its own address bar and there is no host to talk to, so deep-link state is unavailable by design.

The client is safe to construct either way.
Nothing throws at construction, and it never rewrites a URL it does not own — the launch parameter is only scrubbed when the app is actually embedded.

`isSupported()` is the single branch point.
It resolves to `undefined` when the app is not embedded, so the same check that guards a share button also selects your standalone path.

```typescript
const capabilities = await appState.isSupported();

if (capabilities) {
  // Embedded in Fabric: the portal owns the address bar.
  await appState.setState({ view: 'sales', region: 'AT' });
} else {
  // Standalone: the app owns its own URL, so use your router.
  router.push({ path: '/sales', query: { region: 'AT' } });
}
```

What each call does when the app is not embedded:

| Call | Standalone result |
| --- | --- |
| `isSupported()` | `undefined` |
| `getLaunchStateSync()` | seeded state when the URL carries it, otherwise `undefined` |
| `getLaunchState()` | the same, and never rejects |
| `setState()` / `replaceState()` | rejects with `NO_HOST_WINDOW` |
| `onStateChange()` | the listener registers but never fires |

Reads degrade quietly so startup code needs no branching, but writes reject rather than silently doing nothing.
A missing branch therefore surfaces during development instead of dropping state without a trace.
Branch on `isSupported()`, or catch `NO_HOST_WINDOW` if you would rather attempt the write and handle the failure.

## Limits and rules

- State must be a plain JSON object.
  `Date`, `Map`, `Set`, class instances, functions, and `undefined` are rejected rather than silently degraded.
- State is capped at 4 KiB encoded and 20 levels deep, so links survive proxies, mail gateways, and chat clients.
  For anything larger, store it yourself and put an identifier in the state.
- Your app owns the shape of its state.
  The encoding is versioned, but the payload is not, so a link shared before a shape change will still arrive in the old shape and your app must tolerate it.

## Error handling

Failures throw `FabricAppStateError` with a stable `code`.
Branch on the code, never on the message.
State values are never included in the code or the message, so these errors are safe to log.

| Code | Meaning |
| --- | --- |
| `INVALID_STATE` | State is not JSON-serialisable |
| `STATE_TOO_LARGE` | State exceeds the encoded-size budget |
| `STATE_TOO_DEEP` | State exceeds the nesting-depth limit |
| `UNSUPPORTED_HOST_CAPABILITY` | Host does not implement deep-link state |
| `NO_HOST_WINDOW` | App is not running embedded in the Fabric portal |
| `BRIDGE_TIMEOUT` | Host did not respond in time |

```typescript
import { FabricAppStateError } from '@microsoft/rayfin-app-state-fabric';

try {
  await appState.setState(nextState);
} catch (error) {
  if (error instanceof FabricAppStateError) {
    if (error.code === 'STATE_TOO_LARGE') {
      // Fall back to storing the state server-side.
    }
  }
}
```

A host that predates this feature, or has the feature switch turned off, surfaces as `UNSUPPORTED_HOST_CAPABILITY` so the app can degrade gracefully instead of treating it as a bug.

## Security

State travels in a URL, so treat it accordingly.

**It is visible to the user.** It appears in the address bar, browser history, bookmarks, screenshots, copied links, and corporate proxy logs.
Never put secrets, access tokens, or personal data in it.
When the state is sensitive, use an opaque identifier that maps to server-side data.

**It is untrusted input.** Anyone can edit a link before sending it, so validate launch state exactly as you would validate a query parameter before using it to drive queries.
Your app should also tolerate state written by a different version of itself.

## Browser requirements

This package is intended for browser environments running embedded in the Fabric portal.

It depends on browser APIs such as `postMessage`, `window.parent`, and `window.location`.
