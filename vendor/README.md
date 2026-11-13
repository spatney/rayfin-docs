# Vendored upstream sources

Frozen snapshots of the Rayfin documentation that ships inside npm packages. These are
**reference only** — `content/docs/` is the source of truth for this site. The snapshots
exist so that a future upstream release can be diffed mechanically rather than by memory.

| Path | Upstream | Version |
| --- | --- | --- |
| `rayfin-guide-2.0.0/` | `@microsoft/rayfin-guide` → `assets/docs` | 2.0.0 |
| `sdk-docs/<package>/` | `@microsoft/<package>` → `assets/docs` | 2.0.0 |
| `sdk-docs/rayfin-embed-host/` | `@microsoft/rayfin-embed-host` → `README.md` (no `assets/docs`) | 2.0.0 |
| `catalog.json` | `@microsoft/rayfin-docs` → `assets/catalog.json` | 2.0.0 |
| `SKILL.md` | `rayfin init ai-files` → `.agents/skills/rayfin/SKILL.md` | 2.0.0 |
| `cli-assets/` | `@microsoft/rayfin-cli` → `assets/` (agent files, skills, templates) | 2.0.0 |

`sdk-docs/` covers `rayfin-core`, `rayfin-data`, `rayfin-client`, `rayfin-auth`,
`rayfin-auth-provider-fabric`, `rayfin-lib`, `rayfin-functions`, `rayfin-storage`,
`rayfin-telemetry`, `rayfin-connectors`, `rayfin-connector-fabric-graphql`,
`rayfin-connector-fabric-semanticmodel`, `rayfin-connector-eventhouse` (formerly
`rayfin-connector-kusto`), `rayfin-connector-fabric-iq-mcp`, `rayfin-app-state-fabric`,
`rayfin-embed-host`, `rayfin-local-dev`, and `fabric-user-data-functions`.

`rayfin-lib` and `rayfin-app-state-fabric` were taken from the `npm/v2.0.0` release tag:
their 2.0.0 builds were not yet on the public registry at capture time, and the tag's
`2.0.0-beta.1` → `2.0.0` diff is version bumps only.

Captured 2026-11-12.

## How upstream docs are distributed

Rayfin packages declare a `rayfinDocs` field in `package.json` pointing at a directory of
markdown. `@microsoft/rayfin-docs` discovers them across installed `node_modules`, which is
what powers `rayfin docs search` and the `rayfin` MCP server. That makes upstream docs
version-locked to a project's installed packages — and unreachable to anyone who does not
already have a Rayfin project. This site exists to close that gap.

## Refreshing

Every Rayfin package shares one version number, so refresh everything together:

```bash
npm pack @microsoft/rayfin-guide@<version>
# extract it, then diff package/assets/docs against vendor/rayfin-guide-<current>
```

Diff the public API too: `npm pack` each `@microsoft/rayfin-*` package at the old and new
version and compare `dist/**/*.d.ts` and `assets/docs/`. Compare `rayfin <command> --help`
across both CLI versions for flag changes, and read `RAYFIN_FEATURE_FLAGS` registrations in
`@microsoft/rayfin-cli/dist/utils/feature-flags.js` to tell shipped behavior from gated
behavior.
