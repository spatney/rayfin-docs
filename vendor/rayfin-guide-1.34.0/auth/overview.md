---
sidebar_position: 1
---

# Configure Rayfin Auth

This guide explains how to configure Rayfin authentication in your application.
`signUp`, `signIn`, `signOut`, and `getSession` cover most flows and return opaque session data managed by Rayfin.

## Features

- **Token management** - Access tokens never exposed to application code.
- **Session Management** - Automatic state tracking with localStorage, sessionStorage, or custom storage.
- **Event System** - React-friendly session change notifications.
- **Isomorphic** - Works in Node.js, React Native, and Electron without crashing.
  The constructor auto-detects the runtime and skips browser APIs when `window` is undefined.
- **Async Storage** - Storage adapters can return promises for async backends (e.g., React Native AsyncStorage).

## Auth client API surface

The auth client exposes the following methods for sign-up, sign-in, session management, and lifecycle events:

| Method | Description |
| --- | --- |
| `signUp({ email, password })` | Register a new user. |
| `signIn({ email, password })` | Authenticate an existing user. |
| `signOut()` | End the current session. |
| `getSession()` | Return the current session (async; check `isAuthenticated` or `user`). |
| `startAutoRefresh()` | Resume automatic token refresh (for React Native / manual control). |
| `stopAutoRefresh()` | Pause automatic token refresh. |
| `onSessionChange(callback)` | Subscribe to session state changes; returns an unsubscribe function. |

> **Important**
> The method name is `onSessionChange`, not `onAuthStateChange`.
> `onAuthStateChange` does not exist on Rayfin's auth client.

Session objects are opaque.
Gate UI logic on the `isAuthenticated` flag or the presence of a `user` property rather than inspecting internal session fields.

Restart the backend (`npx rayfin up`) whenever you enable or disable auth in `rayfin.yml` so the correct endpoints are exposed.

## Configure auth settings

The `rayfin.yml` can be used to configure your authentication service.

Example:

```yaml
services:
  auth:
    enabled: true
    allowedRedirectUris:
      - http://localhost:5173
    customClaims:
      tenant: default
      app_version: 1.0.0
    scopes:
      - read:data
      - write:data
    password:
      enabled: true
    fabric:
      enabled: false
    email:
      enabled: false
      provider: smtp
      senderName: Rayfin Platform
      verificationTokenExpirationHours: 24
      passwordResetTokenExpirationMinutes: 30
      smtp:
        host: localhost
        port: 1025
        senderEmail: noreply@rayfin.local
        username: ""
        password: ""
        useSsl: false
        useStartTls: false
        webPort: 1080
```

- Set `services.auth.enabled` to `true` to expose Rayfin managed auth endpoints.
- Define any custom claims that your frontend will read from the session (tenant, roles, release channels, and so on).
- Toggle `email.enabled` to `true` plus SMTP metadata if you want verification or password reset flows.
- Set `fabric.enabled` to `true` to enable Fabric brokered authentication (Entra SSO through the Fabric Portal).
  See [Fabric Brokered Auth](./fabric.md) for the full setup and client-side integration guide.
- Restart `npx rayfin up` whenever this file changes so configuration is reloaded.

## Initialize auth

1. Import RayfinClient and instantiate it with your backend base URL plus the publishable key so API calls route to the correct Rayfin environment.
2. Call `client.auth.signIn({ email, password })` to authenticate the current user; Rayfin manages session cookies and tokens internally.
3. Retrieve the active session via `client.auth.getSession()`; checking `session.isAuthenticated` or `session.user` lets you gate UI logic.
4. Once signed in, the same client instance automatically attaches the auth context to data calls, so you can call `client.data.Todo.getAll()` (or any other entity) without re-supplying credentials.

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';

const client = new RayfinClient({
  baseUrl: 'http://localhost:5168',
  publishableKey: 'pk-commonSampleAppKey',
});

await client.auth.signIn({ email, password });
const session = client.auth.getSession();

// Data API automatically authenticated
await client.data.Todo.getAll();
```

## Using custom hook for React

That hook keeps React in sync with the Rayfin auth session.

- Grab the current session once on mount via `auth.getSession()` and store it in component state so the UI can react to updates.
- Register `auth.onSessionChange(setSession)` inside `useEffect` to subscribe to Rayfin’s session events; anytime the backend refreshes or invalidates the session, your state updates automatically.
- Because everything funnels through one hook, any component can read `useAuth()` to gate routes, show user info, or trigger login/logout flows with minimal boilerplate.

```typescript
import { useState, useEffect } from 'react';
import { auth } from './lib/rayfin';
import type { OpaqueSession } from '@microsoft/rayfin-auth';

export function useAuth() {
  const [session, setSession] = useState<OpaqueSession | null>(null);

  useEffect(() => {
    setSession(auth.getSession());
    return auth.onSessionChange(setSession);
  }, []);

  return {
    ...session,
    isAuthenticated: session?.isAuthenticated ?? false,
    signIn: auth.signIn.bind(auth),
    signOut: auth.signOut.bind(auth),
  };
}
```
