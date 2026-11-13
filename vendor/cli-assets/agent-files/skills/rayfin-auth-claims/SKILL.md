---
name: rayfin-auth-claims
description: "Use when the user asks for Rayfin dynamic auth claims or the project already enables them. Triggers: dynamic claims, custom claims from an auth function, udf.authClaims, AuthClaimsContext, services.auth.dynamicClaims, claims.contract.json, claims.generated.d.ts, ctx.getClaims, auth.getClaims, refreshSession with updated claims"
metadata:
  author: microsoft
  version: "0.1.0"
---

# Rayfin Dynamic Auth Claims

Do not select or suggest dynamic auth claims unless the user explicitly asks for dynamic claims, an auth function, or `udf.authClaims`, or the project already sets `services.auth.dynamicClaims.enabled: true`.

Use this workflow when the user asks for dynamic claims, an auth function,
external-entitlement-driven authorization, tenant or account claims, or a
custom `udf.authClaims` provider.

The user should only need to describe the business access model.
Infer and implement the Rayfin mechanics below without asking them to provide
decorators, generated-file names, or deployment commands.

## Required workflow

1. Inspect the existing auth mode, data schema, functions project, connector
   policies, and user-facing roles before editing.
2. Enable the feature under `services.auth.dynamicClaims` in `rayfin/rayfin.yml`.
3. Run `rayfin functions init` to create the functions project before any
   policy references custom claims.
4. Add exactly one `udf.authClaims` provider that resolves the authenticated
   identity to a closed set of required scalar claims. Look entitlements up
   from a trusted **external** system, or (platform-gated) from
   the app's own database with raw SQL via `AuthClaimsContext & WithSql`
   (see "What the provider can and cannot do" below).
5. Run `rayfin functions init` again to generate the provider contract and
   typed claim declarations, then use those claims in server-side policies.
6. Regenerate function and claim artifacts with Rayfin tooling after provider
   signature changes.
7. Test each role, a cross-account denial, a cross-region denial when relevant,
   and the missing-entitlement fail-closed path.
8. Preview deployment, review destructive schema changes, deploy with
   `rayfin up`, and verify with `rayfin up status`.

Enable the authoring and runtime surface before generating claim artifacts:

```yaml
services:
  auth:
    dynamicClaims:
      enabled: true
  functions:
    enabled: true
    buildCommand: npm run build
```

`services.auth.dynamicClaims.enabled` is the single authored source of truth:
it both opts into the authoring/codegen surface and is the per-app runtime
enable BaaS reads. The deploy flow merges the generated claim contract into
that same `services.auth.dynamicClaims` node without disturbing the authored
`enabled`.

Dynamic claim names must not collide with any static claim declared in
`services.auth.customClaims`; `rayfin up`/`rayfin dev` reject the ambiguity.

## What the provider can and cannot do

`ctx.auth` is host-verified and immutable.
It contains only `userId` and `email`; there is no trusted input role, and no
`role` on `ctx.auth` — Rayfin's base role is a platform authorization class
(`Anonymous`/`Authenticated`), not an application entitlement.
Normalize email before lookup and never log either identity field.

The provider runs **before** any Rayfin token exists for the caller, so its
context exposes only:

- `ctx.auth` — the host-verified identity.
- `ctx.getSecret(name)` — reads an app secret, for calling an external
  entitlement system with an application credential.
- `ctx.sql` — **only** when the context is annotated
  `AuthClaimsContext & WithSql` (see "Reading entitlements from the app
  database" below).

There is no `accessToken`, `getClaims()`, `getDataClient()`, `getToken()`,
connection bindings, `baseUrl`, or `publishableKey` on this context, and
`udf.authClaims` does not accept connection declarations. The typed entity
client (`getDataClient()`) and managed connections are unavailable; the only
path to Rayfin-owned data is raw SQL through `WithSql`.

Declare exactly one provider, pass it inline (a named function or variable is
rejected at build time, the same rule as `udf.func`), and give its return
value an explicit type so generated claims do not narrow to string literals:

```ts
import {
  UserDataFunctions,
  type AuthClaimsContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.authClaims(
  async (
    ctx: AuthClaimsContext,
  ): Promise<{
    accessRole: string;
    accountId: string;
    accountName: string;
    serviceTier: string;
    region: string;
  }> => {
    const apiKey = ctx.getSecret("ENTITLEMENTS_API_KEY");
    if (!apiKey) {
      throw new Error("Entitlements API is not configured.");
    }

    const response = await fetch(
      `https://entitlements.example/users/${encodeURIComponent(ctx.auth.userId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) {
      throw new Error(`Entitlements lookup failed (${response.status}).`);
    }

    const assignment = (await response.json()) as {
      accessRole: string;
      accountId: string;
      accountName: string;
      serviceTier: string;
      region: string;
      isActive: boolean;
    };

    if (!assignment?.isActive) {
      throw new Error("No active access assignment exists for this identity.");
    }

    return {
      accessRole: assignment.accessRole,
      accountId: assignment.accountId,
      accountName: assignment.accountName,
      serviceTier: assignment.serviceTier,
      region: assignment.region,
    };
  },
);
```

Authorize the lookup with `ctx.auth.userId` (stable) or normalized
`ctx.auth.email`; never accept caller-supplied identity or authority.
Missing entitlements, read failures, timeouts, and invalid return shapes must
throw. Never fall back to broad default claims because token issuance is fail
closed.

When the app must refuse a user on purpose (for example, only staff may sign
in), call `ctx.denySignIn("Only support staff can sign in.")` instead of
throwing a generic error. The backend answers 403 and mints no token. The
reason may be shown to the user, so keep it free of secrets and other users'
data; it is capped at 256 characters. Use plain `throw` for lookup failures so
they stay distinguishable from a deliberate denial.

On the client, a denial rejects with `AuthError` code `SIGN_IN_DENIED` (the
message is the reason, except for `signInWithEntraToken`, which never reads
error bodies). Provider failures reject with `AUTH_CLAIMS_UNAVAILABLE` (503,
`Retry-After: 5`), `AUTH_CLAIMS_FAILED`, or `AUTH_CLAIMS_INVALID_OUTPUT`. The
backend puts the code in an `x-ms-rayfin-error-code` header and in the body
(`{ "error": { "code", "message" } }`, or `{ "code", "message" }` through the
Fabric front door), and never logs the denial reason. In provider SQL, table
names are the pluralized entity names (entity `Membership` is table
`Memberships`).

### Reading entitlements from the app database

When entitlements live in an app entity (for example a `Membership` table),
annotate the context `AuthClaimsContext & WithSql` and use the raw SQL
endpoint. The annotation is the declaration: the CLI records the `sql`
capability and the platform issues a per-sign-in ticket. It works only where
the platform has enabled provider SQL; elsewhere, every statement fails and
sign-in fails closed. It is not available under `rayfin dev`.

```ts
import {
  UserDataFunctions,
  type AuthClaimsContext,
  type WithSql,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

udf.authClaims(
  async (
    ctx: AuthClaimsContext & WithSql,
  ): Promise<{ accessRole: string; accountId: string; region: string }> => {
    const { rows } = await ctx.sql.query(
      "SELECT TOP 2 accessRole, accountId, region FROM Memberships WHERE userId = @userId",
      { userId: ctx.auth.userId },
    );
    if (rows.length !== 1) {
      throw new Error("Expected exactly one membership for this identity.");
    }
    const [accessRole, accountId, region] = rows[0];
    return {
      accessRole: String(accessRole),
      accountId: String(accountId),
      region: String(region),
    };
  },
);
```

- Raw SQL **bypasses entity policies** and runs as the app, not the user.
  Always parameterize and filter by `ctx.auth.userId`; never interpolate.
- Use the physical table name from the deployed schema, which may differ from
  the entity class name.
- Read only. Do not write from the provider; it runs on every sign-in and
  refresh.
- Select `TOP 2` and throw unless exactly one row matches, so duplicate or
  missing rows fail closed instead of minting ambiguous claims. On a
  PostgreSQL app (`services.data.dialect: postgresql` in `rayfin.yml`) write
  `SELECT "accessRole", "accountId", "region" FROM "Memberships" WHERE "userId" = @userId LIMIT 2`
  instead — PostgreSQL names are case-sensitive, so quote them; `@name`
  parameters work on both.
- **Known limitation — PostgreSQL:** raw SQL fails with `SqlDialectNotSupported`,
  so a PostgreSQL provider that uses `WithSql` fails sign-in closed.
  A service fix is expected by December 14, 2026.
  Until support is confirmed in the target environment, do not generate a
  PostgreSQL raw SQL claims provider as a working solution.
  Use a trusted external entitlement source instead, or explain that the
  app-database lookup is blocked.
  The provider has no data client.
  Do not infer availability from the date or installed SDK version alone.

Claim values must form a closed record of required `string`, `number`, or
`boolean` properties.
Do not return optional values, nulls, arrays, nested objects, index signatures,
or mixed-type unions. Literal unions of one scalar type (for example
`'free' | 'pro'`) are widened to that type (`string`).
Do not use reserved names such as `sub`, `email`, `role`, `sid`, `iss`, `aud`,
`exp`, `iat`, `nbf`, `jti`, `name`, `scope`, or names beginning with `dc_`,
`rfn_`, or `xms_` (all compared case-insensitively). Claim names must match
`^[A-Za-z][A-Za-z0-9_]*$`, be at most 64 bytes, and must not differ from each
other only by case. A provider may return at most 8 claims.

## Consuming generated claims in a regular UDF

Once minted, custom claims are available from a **regular** `RayfinContext`
via `ctx.getClaims()` — this is unrelated to the provider's own restricted
context, and is the only place `getClaims()` exists. It validates the decoded
token against the bundled claims contract, throwing if a required claim is
missing or has the wrong type (for example when dynamic claims are disabled at
runtime or the token predates the contract):

```ts
udf.func(
  "listAccessibleAccounts",
  async (ctx: RayfinContext): Promise<string[]> => {
    const claims = ctx.getClaims();
    const rows = await ctx
      .getDataClient()
      .Account.select(["id"])
      .where({ id: { eq: claims.accountId } })
      .execute();
    return rows.map((row) => row.id);
  },
  [],
);
```

On the client, `client.auth.getClaims()` returns every custom claim as a
string, because that is how the token carries it (`false` arrives as
`'false'`). Compare with `=== 'true'` or parse the value, and never rely on
client-side claims for authorization.

## Policies and generated artifacts

Use generated claims directly in the policy DSL:

```ts
@role('authenticated', 'read', {
  policy: (claims, item) =>
    claims.accountId
      .eq(item.account_id)
      .and(claims.region.eq(item.region)),
})
```

Every entity must still have explicit permissions.
Do not rely on the absence of decorators to deny access because that grants
authenticated CRUD by default.

Rayfin generates these files from the provider:

- `rayfin/auth/claims.generated.d.ts` augments the policy DSL and function
  context with typed custom claims.
- `rayfin/auth/claims.contract.json` defines the runtime validation contract
  consumed by the deploy controller, the BaaS token workflow, and (bundled
  into the functions app) `RayfinContext.getClaims()`.
- `rayfin/functions/src/types.ts` contains client-callable function types;
  the privileged auth provider itself is not client callable.

With a custom `services.functions.path`, the `auth` folder sits next to the
functions folder (for example `packages/auth/` for `packages/functions`).

Never hand-edit generated claim, function type, deployment metadata, or DAB
configuration files.
Use `rayfin functions init` for one-shot restore, build, and type generation,
or `rayfin dev functions apply` when running the local function host.

## Deployment and verification

Use this command sequence after implementation:

```bash
rayfin functions init
rayfin up --dry-run
rayfin up
rayfin up status
```

Inspect generated schema changes before adding `--force`.
Only use `--force` after the user approves destructive app-database changes.

BaaS validates the provider's output against the stored contract at every
sign-in, so the stored contract must match the deployed provider. `rayfin up`
and `rayfin up functions deploy` send the generated contract with
`services.auth.dynamicClaims.enabled` only after the functions deploy
succeeds, so a failed deploy leaves the stored contract matching the running
code. `rayfin up functions deploy` updates the stored contract only when it
changed, and clears it if the provider was removed. `rayfin up staticapp
deploy`, `rayfin up --exclude-services functions`, and `rayfin dev` keep the
stored contract because they do not change the deployed provider. The
generated contract is never written into `rayfin.yml`. A full `rayfin up`
regenerates the contract from the current provider before deploying,
and fails if `services.auth.dynamicClaims.enabled` is `true` without a provider
or with Functions disabled. `rayfin up functions deploy` refuses to deploy code
that removes the provider while `services.auth.dynamicClaims.enabled` is `true`.
Every settings write sends the authored `services.auth.dynamicClaims.enabled`,
so setting it to `false` and running any deploy is the kill switch for a
failing provider; no functions redeploy is needed.

Verify all of the following:

- The provider mints only the claims its entitlement lookup returns, and
  throws — never silently omitting claims — on any lookup failure.
- Account and region policies filter data on the server using the minted
  claims.
- Cross-account and cross-region requests return no rows or authorization
  failure.
- Revoking or disabling an entitlement prevents the next token from carrying
  it.
- No email, user ID, token, secret, or custom claim value appears in logs or
  telemetry.
- `rayfin up`/`rayfin dev` reject a dynamic claim name that collides with a
  static `services.auth.customClaims` name, and reject a connection
  declaration on `udf.authClaims`.

Connector-backed policy behavior cannot be validated through `rayfin dev`.
Connectors are cloud-only, so deploy and exercise the configured Fabric source
to verify account and region filtering.

Authorization changes apply when Rayfin mints the next access token.
Call `client.auth.refreshSession()` to remain signed in with newly minted
claims, or sign out when the current token must stop being used immediately.
