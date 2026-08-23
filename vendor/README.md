# Vendored upstream sources

Frozen snapshots of the Rayfin documentation that ships inside npm packages. These are
**reference only** — `content/docs/` is the source of truth for this site. The snapshots
exist so that a future upstream release can be diffed mechanically rather than by memory.

| Path | Upstream | Version |
| --- | --- | --- |
| `rayfin-guide-1.34.0/` | `@microsoft/rayfin-guide` → `assets/docs` | 1.34.0 |
| `sdk-docs/rayfin-core/` | `@microsoft/rayfin-core` → `assets/docs` | 1.31.x |
| `sdk-docs/rayfin-data/` | `@microsoft/rayfin-data` → `assets/docs` | 1.31.x |
| `sdk-docs/rayfin-client/` | `@microsoft/rayfin-client` → `assets/docs` | 1.31.x |
| `sdk-docs/rayfin-auth/` | `@microsoft/rayfin-auth` → `assets/docs` | 1.31.x |
| `sdk-docs/rayfin-auth-provider-fabric/` | `@microsoft/rayfin-auth-provider-fabric` → `assets/docs` | 1.31.x |
| `sdk-docs/rayfin-lib/` | `@microsoft/rayfin-lib` → `assets/docs` | 1.31.x |
| `catalog.json` | `@microsoft/rayfin-docs` → `assets/catalog.json` | schemaVersion 1 |
| `SKILL.md` | `rayfin init ai-files` → `.agents/skills/rayfin/SKILL.md` | 0.3.0 |

Captured 2026-08-22.

## How upstream docs are distributed

Rayfin packages declare a `rayfinDocs` field in `package.json` pointing at a directory of
markdown. `@microsoft/rayfin-docs` discovers them across installed `node_modules`, which is
what powers `rayfin docs search` and the `rayfin` MCP server. That makes upstream docs
version-locked to a project's installed packages — and unreachable to anyone who does not
already have a Rayfin project. This site exists to close that gap.

## Refreshing

```bash
npm install @microsoft/rayfin-guide@latest
# then diff node_modules/@microsoft/rayfin-guide/assets/docs against vendor/rayfin-guide-1.34.0
```
