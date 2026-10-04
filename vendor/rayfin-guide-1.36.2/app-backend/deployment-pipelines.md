---
sidebar_position: 46
---

# Fabric Deployment Pipelines

Microsoft Fabric's **Deployment Pipelines** feature promotes an AppBackend between dev/test/prod-style workspace stages without rebuilding it — the same pre-built artifact moves forward as-is.
This page covers what that means for a Rayfin app and how to check whether yours is ready for it.

## What actually moves

An AppBackend's exported definition is a portable package of pre-built artifacts, not source code:

```text
MyAppBackend.AppBackend/
├── .platform            Fabric-managed item metadata
├── rayfin.yml            Services config (auth, data, storage, staticHosting) — promotes as-is
├── dab-config.json       Pre-generated DAB entity schema — promotes as-is (dialect-locked)
└── static-app.zip        Compiled SPA bundle — promotes as-is (byte-identical across stages)
```

### `rayfin.config.json` — generated per stage, not promoted

When you deploy with `rayfin up`, the CLI writes a `rayfin.config.json` file into `StaticAssets/` alongside the compiled SPA, containing that stage's API URL, publishable key, and Fabric item metadata.
`resolveRayfinConfig()` reads this file automatically at runtime when it's present, and falls back to whatever `apiUrl`/`publishableKey` defaults you pass in — typically your `VITE_RAYFIN_*` env vars — when it's not, which is the local-dev case before you've ever run `rayfin up`.

This is exactly why `rayfin.config.json` is **deliberately excluded** from the exported definition above: Fabric regenerates it fresh in the target workspace on every Import, using that stage's own API URL, publishable key, and item metadata, so a stale Dev config can never leak into Prod as your app moves through the pipeline.

## Read your backend config with `resolveRayfinConfig()`

Because the compiled SPA bundle moves unchanged between stages, resolve your backend URL and key through `resolveRayfinConfig()` before constructing `RayfinClient` / `RayfinServerClient`, rather than constructing the client from your env vars directly.
Your `VITE_RAYFIN_API_URL` / `VITE_RAYFIN_PUBLISHABLE_KEY` env vars still belong in your app — `rayfin dev` depends on them — just pass them into `resolveRayfinConfig()` as defaults instead of using them to build the client yourself:

```ts
import { RayfinClient, resolveRayfinConfig } from '@microsoft/rayfin-client';

const resolved = await resolveRayfinConfig({
  apiUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
});
const client = new RayfinClient<Schema>({ ...resolved, authStorage: true });
```

`resolveRayfinConfig()` prefers `rayfin.config.json` when it's present — every deployed stage — and falls back to the `apiUrl`/`publishableKey` defaults you pass in only when the file is absent, which is the local-dev case. Constructing the client directly from build-time values, skipping `resolveRayfinConfig()`, bakes in whatever you pass and never checks for `rayfin.config.json`, so a promoted bundle would keep pointing at the source environment's backend.

For your backend URL and key alone, call `resolveRayfinConfig()`, not `loadRayfinConfig()` directly — `loadRayfinConfig()` is the lower-level primitive `resolveRayfinConfig()` calls internally to fetch `rayfin.config.json`, and `resolveRayfinConfig()` is the one that overlays the result over your defaults and returns what you should construct the client with.
If your app also needs Fabric coordinates for its auth broker, pass them alongside `apiUrl`/`publishableKey` in `resolveRayfinConfig()`'s defaults — see [Fabric auth coordinates](#fabric-auth-coordinates-need-clientruntimeconfig) below.

If you're not sure whether your app already resolves config before constructing the client, check for direct construction:

```bash
grep -rn "new RayfinClient(\|new RayfinServerClient(" src/
```

Any match there should be preceded by a `resolveRayfinConfig()` call, with its result spread into the constructor as shown above — your existing `VITE_RAYFIN_*` reads can stay, just pass them in as `resolveRayfinConfig()`'s defaults instead of using them to construct the client directly.

## Fabric auth coordinates need `client.runtimeConfig`

If your app embeds in Fabric and drives its own auth flow against the Fabric secure-embed broker, `resolveRayfinConfig()`'s `apiUrl`/`publishableKey` alone aren't enough — your auth wiring also needs the Fabric coordinates (`workspaceId`, `itemId`, `portalUrl`) from the same `rayfin.config.json`.

`client.runtimeConfig` is a single `RayfinRuntimeConfig` bag holding every value `rayfin.config.json` can supply (`apiUrl`, `publishableKey`, `workspaceId`, `itemId`, `portalUrl`, `tenantId`) — all fields optional, since neither the remote config nor your defaults are guaranteed to provide every one. Pass your build-time `VITE_FABRIC_*` values into `resolveRayfinConfig()`'s defaults alongside `apiUrl`/`publishableKey`, and read the resolved coordinates off `client.runtimeConfig` after construction:

```ts
const resolved = await resolveRayfinConfig({
  apiUrl: import.meta.env.VITE_RAYFIN_API_URL,
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
  workspaceId: import.meta.env.VITE_FABRIC_WORKSPACE_ID,
  itemId: import.meta.env.VITE_FABRIC_ITEM_ID,
  portalUrl: import.meta.env.VITE_FABRIC_PORTAL_URL,
});
const client = new RayfinClient<Schema>({ ...resolved, authStorage: true });

const { workspaceId, itemId, portalUrl } = client.runtimeConfig ?? {};
```

`resolveRayfinConfig()` resolves `runtimeConfig` from the same `rayfin.config.json` fetch it already makes for `apiUrl`/`publishableKey`, overlaying remote values over your defaults per-field — no extra request. `resolveFabricConfig()`, which made its own independent fetch for just the Fabric fields, has been removed as redundant — always resolve through `client.runtimeConfig` instead.

Reading `workspaceId`/`itemId`/`portalUrl` directly from `VITE_FABRIC_*` env vars — without going through `client.runtimeConfig` — bakes in whatever stage the bundle was *built* in.
Since deployment pipelines promote the same compiled bundle across stages without rebuilding, that mismatch only shows up after a promotion: your API calls correctly hit the new stage's backend (via `resolveRayfinConfig()`'s `rayfin.config.json` read), but your auth broker still points at the *old* stage's workspace/item, because it never read from the runtime config at all.

If you're not sure whether your app resolves Fabric coordinates this way, check for direct reads of `VITE_FABRIC_*` that don't go through `runtimeConfig`/`client.runtimeConfig`:

```bash
grep -rn "VITE_FABRIC_" src/
```

Any match not passed through `runtimeConfig`/`client.runtimeConfig` should be updated as shown above.

## Out of scope today

- **Functions** (`rayfin/functions/`) — not covered by this pattern yet.
- **Secrets** — a separate concern from config-file promotion.
- **Source-code / Git integration** — Deployment Pipelines move built artifacts, not source. [Git integration](https://learn.microsoft.com/en-us/fabric/cicd/git-integration/intro-to-git-integration) is a related but distinct Fabric feature for source-controlling item definitions.

## Related Fabric platform concepts

These are Fabric platform features, not something the Rayfin CLI/SDK controls — see Fabric's own [CI/CD documentation](https://learn.microsoft.com/en-us/fabric/cicd/) for depth:

- **Git integration** — links a workspace to a Git branch for source control of Fabric item definitions.
- **Deployment pipelines** — promotes items between dev/test/prod-style workspace stages; the feature this page covers.
- **Variable libraries** — Fabric-managed, stage-scoped values usable across items; not currently wired to `rayfin.config.json` generation, but conceptually related.
