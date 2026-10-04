---
sidebar_position: 20
---

# Auth

Rayfin Auth gives you managed user authentication, session handling, and token management so you can focus on your application instead of building identity infrastructure.
One call to `signIn()` replaces hundreds of lines of auth plumbing, and every subsequent data call is automatically authenticated.

## Why use Rayfin Auth

- **Zero auth infrastructure** — User management, sessions, and token handling work out of the box with no external identity service to deploy or configure.
- **Auth and data are pre-integrated** — After sign-in, every `client.data.*` call automatically carries the authenticated context.
  No manual header management or token passing between modules.
- **Automatic per-user data isolation** — JWT claims drive row-level security policies defined declaratively in your data model decorators.
  Each user sees only the data they own without writing RLS SQL.
- **Works in every deployment mode** — The same auth code runs identically in local Docker development, self-hosted environments, and managed Fabric hosting.
  No code changes required when you move between environments.

## Auth methods

Rayfin supports multiple authentication methods that you can enable independently:

- **Email and password** — Traditional sign-up and sign-in with managed credentials.
  Enabled by default in new projects.
- **Magic link** — Passwordless sign-in via email links.
- **Fabric brokered auth** — Single sign-on through the Microsoft Fabric Portal using the user's Entra identity.
  See [Fabric Brokered Auth](./fabric.md) for setup and usage.
- **Direct Entra token sign-in** — Exchange an existing delegated Entra token for a Rayfin session from a browser or Node.js app.
  See [Direct Entra token sign-in](./direct-entra-auth.md).
- **External embed host** — Broker sign-in for a Rayfin app embedded in your own third-party portal, using the portal's Entra token.
  See [External embed host](./external-embed-host.md).

## Next steps

- [How to configure auth](./overview.md)
- [Fabric brokered auth](./fabric.md)
- [Direct Entra token sign-in](./direct-entra-auth.md)
- [External embed host](./external-embed-host.md)
