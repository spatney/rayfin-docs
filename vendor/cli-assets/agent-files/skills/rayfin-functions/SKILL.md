---
name: rayfin-functions
description: "Use when writing Rayfin user-defined functions (UDFs), invoking functions from frontend code, or using functions CLI commands. Triggers: rayfin functions, udf.func, UserDataFunctions, RayfinContext, FabricContext, AppFunctionsSchema, functions init, dev functions apply, client.functions, invoke, func start, function_app.ts, types.ts, rayfin/functions/, FunctionClient, FunctionsSchema, fabric-user-data-functions, functionsBaseUrl, rayfinLocalDev, resolveRayfinFunctionsBaseUrl, VITE_RAYFIN_FUNCTIONS_URL"
metadata:
  author: microsoft
  version: "0.2.0"
---

# Rayfin Functions

For Rayfin 2.x, register `functions: functionsService<AppFunctionsSchema>()` in the existing `RayfinClient.create({ services: { ... } })` call.
Import `functionsService` and function schema contracts from `@microsoft/rayfin-functions`, not the client package.
Preserve the existing authentication adapter and other service registrations.

Server-side user-defined functions (UDFs) that run in the Fabric runtime and are invocable from your frontend via `RayfinClient`. Write trusted backend logic once; get a type-safe client call on the frontend.

The full reference lives in the Rayfin guide. **Read the doc for the task you're doing before writing code** — don't guess API shapes, endpoints, or CLI flags. Read a doc off disk from `node_modules/@microsoft/rayfin-guide/assets/docs/<path>`, or fetch it with `rayfin docs get --module guide --path '<path>'` — or `get_doc` with `module: "guide"` via MCP.

## Where to read

| Task | Doc path |
| --- | --- |
| Overview, auth configuration and identities, project structure, first function | `functions/index.md` |
| `udf.func()` API, `RayfinContext`, data access, importing entities | `functions/writing-functions.md` |
| How `types.ts` is generated and kept in sync | `functions/typegen.md` |
| Reading secrets inside a function | `functions/secrets.md` |
| Calling functions from the frontend (`client.functions.*.invoke`) | `functions/invoking-from-frontend.md` |
| Bulk import and CSV import functions | `functions/bulk-import.md` |
| Connecting to external resources — audiences, recipe chooser, per-resource walkthroughs | `functions/connections/index.md` |
| CLI: scaffold, local host, deploy | `cli/functions/index.md`, `init.md`, `dev-apply.md`, `deploy.md` |

## Connections and secrets

**Read `functions/connections/index.md` before writing any connection code, and `functions/secrets.md` before reading a secret.** Both are the source of truth; the summary below exists only so you know what to look for.

Enabled Functions require `services.functions.auth.type: application`.
Read **Application authentication** in `functions/index.md` for the configuration, identity model, and deployment requirements.

- Generic connections are declared **on the context annotation** — `RayfinContext<AppSchema, AudienceType.Sql | AudienceType.Storage>` — and read as `ctx.Tokens.Sql`.
  The annotation is what registers the binding, so the third argument of `udf.func()` stays `[]`.
- Supported audiences are `Sql`, `Storage`, `Fabric`, `AzureAI`, and `ADO`. Any other Entra-protected resource is declared as a custom audience string (application ID or `https://` / `api://` resource URI, never a `/.default` scope) and read as `ctx.Tokens["api://contoso-api"]`.
- `ctx.Tokens.*` uses the app identity for external resources; `ctx.getDataClient()` uses the caller's Rayfin token for Rayfin DB access.
  Keep tokens server-side.
- Audiences are resolved by the TypeScript compiler at deploy time, so a type alias works — but prefer literal `AudienceType.Sql`, and keep a `tsconfig.json` in the functions project. Without one the CLI reads the annotation syntactically, cannot resolve aliases, and warns.
- Secrets are declared with `rayfin secret set`, recorded in `rayfin.yml`, and read as `ctx.Secrets.STRIPE_API_KEY`. The CLI generates `secrets.generated.ts` under the functions project's `src/` folder; **never hand-edit it and never hard-code a secret name**.
- `ctx.getToken()` and `ctx.getSecret()` are **deprecated** and flagged by `@typescript-eslint/no-deprecated`. Use `ctx.Tokens` and `ctx.Secrets`.

### Get the Fabric info for the user

Connection code needs real endpoints — the SQL server or the OneLake path.
**Resolve these yourself; don't ask the user to paste connection strings.**
When the user names a Fabric item ("connect to lakehouseA in workspaceB"), turn the workspace + item display names into coordinates:

- If a **Fabric CLI** (e.g. `fab`) or **Fabric MCP** is already available in the workspace, prefer it — it wraps the same endpoints.
- Otherwise call the **Fabric REST API** directly: base `https://api.fabric.microsoft.com/v1`, token from `az account get-access-token --resource https://api.fabric.microsoft.com`.

Only fall back to asking the user when the name matches multiple items, the lookup returns 403 (no access), or you can't determine the workspace. The full lookup workflow is in `functions/connections/get-fabric-info.md`.

## Local functions routing

Read `functions/invoking-from-frontend.md` before changing frontend routing.
Bundled Vite templates already use `rayfinLocalDev()` from
`@microsoft/rayfin-local-dev`. Leave `functionsBaseUrl` undefined so the SDK
uses `/functions/<name>/invoke`; the adapter forwards that same-origin route to
the local Functions host selected by `rayfin dev`.
For custom or older Vite projects, add the adapter as documented. Use
`resolveRayfinFunctionsBaseUrl()` only when existing code must explicitly
provide a Functions base URL.
For other frameworks, pass the framework-mapped Functions URL only during development.

## Bulk import and CSV imports

Read `functions/bulk-import.md` before writing a CSV or bulk import.
Required pattern:

- Frontend accepts pasted text in a labelled `<textarea>`, has an obvious import button, renders the typed result immediately in `role="status"`, and uses `role="alert"` for unexpected failures.
- Function parses header and rows server-side, matches header names case-insensitively after trimming, bounds input size, validates every row, returns `{ imported, rejected: [{ row, reason }] }`, and never returns secrets.
- Reject invalid rows; do not coerce missing required fields into defaults or accept non-domain values such as zero or negative expense amounts unless the domain explicitly models them.
- Resolve or create referenced records idempotently through `ctx.getDataClient()` so caller policies apply.
- Stamp owner fields with `ctx.user.id`; never decode `ctx.accessToken` for ownership.
- For relationship writes, pass either the FK scalar such as `account_id` or the relationship object such as `account: { id }`, never both.
- Verify with a mixed valid/invalid fixture through the UI or documented invocation path; `validate:functions` only proves generated contract freshness.

## Raw SQL (`ctx.sql`)

> **Known limitation — PostgreSQL:** raw SQL is not yet available on PostgreSQL apps.
> Calls to `ctx.sql.query()` and `ctx.sql.execute()` fail with `SqlDialectNotSupported`.
> A service fix is expected by December 14, 2026.
> Until support is confirmed in the target environment, use `ctx.getDataClient()` for supported entity operations; do not generate PostgreSQL raw SQL as a working solution.
> If the data client cannot express the operation, explain the limitation rather than silently changing the database dialect.
> Do not infer availability from the date or installed SDK version alone.
> The PostgreSQL guidance below applies only after service support is confirmed.

Prefer `ctx.getDataClient()`: it applies entity policies, while raw SQL runs as the app and bypasses them.
Use raw SQL only for queries the data client cannot express, such as aggregates or reports.

- Declare it on the context: `RayfinContext<AppSchema> & WithSql`, then `ctx.sql.query(sql, params)` or `ctx.sql.execute(sql, params)`.
- Read `services.data.dialect` in `rayfin.yml` first and write SQL for that database. The SDK does not translate.
  - `mssql`: T-SQL — `SELECT TOP 10 …`, `OFFSET … FETCH`, `GETUTCDATE()`, `[Name]`.
  - `postgresql`: PostgreSQL — `… LIMIT 10`, `LIMIT … OFFSET …`, `now()`, `ILIKE`. Table and column names are case-sensitive: quote them, e.g. `SELECT "title" FROM "Todos"` (an unquoted `Todos` is read as `todos` and fails). Add a cast only when PostgreSQL cannot infer a parameter's type from where it is used, e.g. `@x::text` in `SELECT @x IS NULL`.
- Write parameters as `@name` on both, and pass values in `params`. Never interpolate values into the SQL string.
- `ctx.sql` runs only in deployed functions, not under `rayfin dev`, and only where the platform has raw SQL enabled. Verify raw SQL against the deployed app; a local-mode error is expected, not a bug to fix.
- Branch on `error.code` (same on both databases), not on the message. `sqlErrorNumber` is SQL Server only; `sqlState` is PostgreSQL only.
- Results are capped at 1,000 rows and a size limit; select only the columns you need.

## Guardrails

- Import `RayfinContext` from `@microsoft/fabric-user-data-functions` — **not** from `@microsoft/rayfin-functions`.
- Register every function with `udf.func(name, handler, [])` — don't export bare functions.
- Use `import type` for data-entity imports — a runtime import pulls the decorator runtime into the functions bundle.
- Never hand-edit `rayfin/functions/src/types.ts` — typegen regenerates it and will overwrite your edits.
- Never expose a local Functions URL in production; leave `functionsBaseUrl` undefined so `invoke()` targets the deployed backend.
- Install resource SDK packages in `rayfin/functions/package.json`, not the project root.
- Prefer secrets via `rayfin secret set <NAME>` read through `ctx.Secrets`; use `process.env` only for local debugging.
