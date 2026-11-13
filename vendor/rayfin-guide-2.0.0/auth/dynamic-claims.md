---
sidebar_position: 5
---

# Dynamic auth claims

Dynamic auth claims let an app mint application-defined claims (for example `accountId`, `region`, `supportRole`) into the Rayfin access token when a user signs in or refreshes. The app defines a single `udf.authClaims` provider function. Server-side data policies then filter on those claims.

## Enable

```yaml
services:
  auth:
    dynamicClaims:
      enabled: true
  functions:
    enabled: true
```

Declaring `services.auth.dynamicClaims` opts the project into claim code generation, and `enabled` is the per-app runtime enable that the backend reads. The backend must also have dynamic auth claims enabled for your workspace's region; until it does, sign-in and refresh mint base claims only and never call the provider.

## Provider

Declare exactly one provider with an explicit, closed return type made only of required `string`, `number`, or `boolean` properties:

```ts
import {
  UserDataFunctions,
  type AuthClaimsContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.authClaims(
  async (
    ctx: AuthClaimsContext,
  ): Promise<{ accountId: string; region: string }> => {
    // ctx.auth is host-verified: { userId, email }. ctx.getSecret(name) reads an app secret.
    // Look up entitlements in a trusted external system; throw on any failure.
    // ...
  },
);
```

- The provider runs before any Rayfin token exists for the caller. It has no data client and no connection bindings.
- Pass the provider inline, as in `udf.authClaims(async (ctx) => { ... })`. Like `udf.func`, a named function or variable is rejected at build time.
- If the provider throws, returns nothing, or returns a value that does not match the contract, token issuance fails closed. Issuance also fails if the host does not supply a user ID.
- The return type must be a closed record of at most 8 required `string`, `number`, or `boolean` claims. Literal unions of one scalar type are widened; mixed unions, nulls, arrays, and objects are rejected.
- Claim names must match `^[A-Za-z][A-Za-z0-9_]*$` and be at most 64 bytes. They must not collide (case-insensitively) with reserved names (`sub`, `email`, `role`, `iss`, `aud`, `exp`, and so on), reserved prefixes (`dc_`, `rfn_`, `xms_`), each other, or static `services.auth.customClaims` names.

### Entitlements in the app database

To look entitlements up in an app entity instead of an external system, annotate the context `AuthClaimsContext & WithSql` and query with raw SQL:

```ts
import {
  UserDataFunctions,
  type AuthClaimsContext,
  type WithSql,
} from "@microsoft/fabric-user-data-functions";

udf.authClaims(
  async (
    ctx: AuthClaimsContext & WithSql,
  ): Promise<{ accountId: string; region: string }> => {
    const { rows } = await ctx.sql.query(
      // SQL Server. On a PostgreSQL app, quote the case-sensitive names and use LIMIT:
      // 'SELECT "accountId", "region" FROM "Memberships" WHERE "userId" = @userId LIMIT 2'
      "SELECT TOP 2 accountId, region FROM Memberships WHERE userId = @userId",
      { userId: ctx.auth.userId },
    );
    if (rows.length !== 1) throw new Error("Expected exactly one membership.");
    return { accountId: String(rows[0][0]), region: String(rows[0][1]) };
  },
);
```

- Provider SQL is gated separately by the platform. Where it is not enabled, statements fail and sign-in fails closed. It does not run under `rayfin dev`.
- **Known limitation — PostgreSQL:** raw SQL is not yet available on PostgreSQL apps.
Statements fail with `SqlDialectNotSupported`, and sign-in fails closed.
A service fix is expected by December 14, 2026; confirm support in the target environment before using the PostgreSQL example above.
The date or installed SDK version alone does not establish service availability.
Until then, use a trusted external entitlement source or defer the app-database lookup.
The claims provider cannot use `ctx.getDataClient()`.
- Raw SQL bypasses entity policies and runs as the app. Always parameterize and filter by `ctx.auth.userId`.
- Table names are the pluralized entity names: entity `Membership` is table `Memberships`.
- Keep provider statements read-only; the provider runs on every sign-in and refresh.

`rayfin functions init` (or `rayfin dev functions apply`) generates `rayfin/auth/claims.generated.d.ts`, which gives typed claims in policies, and `rayfin/auth/claims.contract.json`, which is the runtime validation contract.
With a custom `services.functions.path`, both files go in an `auth` folder next to the functions folder (for example `packages/auth/` for `packages/functions`).

### Deny sign-in

To refuse a sign-in on purpose, for example when the user is not on a staff list, call `ctx.denySignIn(reason)`:

```ts
udf.authClaims(
  async (ctx: AuthClaimsContext): Promise<{ supportRole: string }> => {
    const role = await lookUpStaffRole(ctx.auth.userId);
    if (!role) {
      ctx.denySignIn("Only support staff can sign in to this app.");
    }
    return { supportRole: role };
  },
);
```

- The backend answers the sign-in with 403 and mints no token.
- The reason may be shown to the signing-in user, so do not put secrets or another user's data in it.
- The reason is trimmed, stripped of control characters, and capped at 256 characters; without one, a default message is used.
- Throwing `SignInDeniedError` from `@microsoft/fabric-user-data-functions` has the same effect.
- Any other error still fails the sign-in, but as a provider failure rather than a denial.
- `denySignIn` returns `never`, so it does not change the generated claims contract.

On the client, `signIn`, the magic-link code exchange, `refreshSession`, and `signInWithEntraToken` reject with an `AuthError` whose `code` tells you what happened:

| `code` | Meaning |
|---|---|
| `SIGN_IN_DENIED` | The claims function denied this user; `message` is its reason. On refresh, the session also ends. |
| `AUTH_CLAIMS_UNAVAILABLE` | The claims function timed out or could not be reached. Retrying may succeed. |
| `AUTH_CLAIMS_FAILED` | The claims function threw or is not deployed. |
| `AUTH_CLAIMS_INVALID_OUTPUT` | The claims function returned claims that do not match the deployed contract. |

`signInWithEntraToken` never reads error bodies, so its `SIGN_IN_DENIED` carries a fixed message instead of the app's reason.

The backend answers these failures with the error code in the `x-ms-rayfin-error-code` response header and in the body.
BaaS writes `{ "error": { "code": "sign_in_denied", "message": "<reason>" } }`; through the Fabric front door the same error arrives as `{ "code": "sign_in_denied", "message": "<reason>", "details": [...] }`.
The SDK reads both shapes.
`503` responses include `Retry-After: 5`; the SDK's refresh backoff already waits at least that long.
The first sign-in after a deploy can hit the 10-second budget while the function app starts, which returns `AUTH_CLAIMS_UNAVAILABLE`; a retry succeeds once it is warm.
The backend never writes the denial reason to its logs.

## Use claims

Filter data in server-side policies:

```ts
@role('authenticated', 'read', {
  policy: (claims, item) =>
    claims.accountId.eq(item.account_id).and(claims.region.eq(item.region)),
})
```

On the client, `client.auth.getClaims()` validates the token and returns the base claims plus the app-defined claims without exposing the access token.
Tokens carry every app-defined claim as a string, so the client returns and types them as strings: a provider's `false` arrives as `'false'` and `42` as `'42'`.
Compare with `=== 'true'` or parse the value yourself, and keep authorization decisions in server-side policies.
In a regular function, `ctx.getClaims()` validates the decoded token against the bundled contract and returns the declared types.

Authorization changes take effect the next time an access token is minted. Call `client.auth.refreshSession()` to stay signed in with updated claims, or `signOut()` when removed access must stop immediately.

## Deploy

The backend validates the provider's output against the stored contract at every sign-in, so the contract must always match the deployed provider.
Commands that deploy functions send the generated contract only after the code deploys; every other settings write keeps the contract the backend already has.

- `npx rayfin up` and `npx rayfin up functions deploy` update the stored contract after the functions deploy succeeds, only when it changed.
  If the functions deploy fails, the backend keeps the contract that matches the code still running.
  If the provider was removed, `up functions deploy` clears the stored node.
- `npx rayfin up staticapp deploy`, `npx rayfin up --exclude-services functions`, and `npx rayfin dev` keep the stored contract, because they do not change the deployed provider.

The generated contract is never written into `rayfin.yml`.
To turn issuance on or off, change `services.auth.dynamicClaims.enabled` and run any deploy: `npx rayfin up`, `npx rayfin up functions deploy`, `npx rayfin up staticapp deploy`, or `npx rayfin dev`.
Every settings write sends the authored `enabled`, so `enabled: false` works as a kill switch for a failing provider without redeploying functions.

When you change the provider's return shape, sign-ins can fail with `AUTH_CLAIMS_INVALID_OUTPUT` for the few seconds between the code deploy and the contract update.
Tokens minted before the change lack the new claims, so `ctx.getClaims()` rejects them until the user refreshes.

## Verify

Test each role, a cross-account denial, a cross-region denial where relevant, and the fail-closed path for a user with no entitlement. Connector-backed policies cannot be validated with `rayfin dev`, so deploy and test against the configured Fabric source.
