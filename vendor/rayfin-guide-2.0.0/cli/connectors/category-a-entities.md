---
sidebar_position: 5
---

# Category A — GraphQL entity connectors

> **Moved.** This reference now ships **inside the connector package**,
> version-locked to the connector the Builder actually installed — so per-dialect
> read/write behavior, SQL-type mappings, and composite-PK semantics can never
> drift from the CLI. It is fetched on demand with `packageVersion` provenance.
>
> Read it from `@microsoft/rayfin-connector-fabric-graphql`:
>
> - MCP: `search_docs` / `discover_packages`
> - CLI: `rayfin docs search "<term>"` (module `rayfin-connector-fabric-graphql`)
> - Source: `@microsoft/rayfin-connector-fabric-graphql/assets/docs/`
>
> Pages: `index.md` (generation workflow, the aggregate `schema.ts`, client
> wiring, worked example), `entities.md` (`@role` row-level policies, the entity
> generation contract, the `metadata.json` reference), `querying.md`,
> `mutations.md`, and `troubleshooting.md`.

## Client composition

Register `connectorsService<AppConnectorsSchema>({ configs })` from `@microsoft/rayfin-connectors` in `RayfinClient.create({ baseUrl, publishableKey, auth, services })`.
Select `browserSession()` from `@microsoft/rayfin-auth` for a browser session, or `suppliedToken()` from `@microsoft/rayfin-client` for externally supplied tokens.
Keep generated connector configs keyed by their schema and `rayfin.yml` names.
Category A retains connector-specific entity metadata, composite keys, CRUD gates, dialect-specific mutation results, and `/connectors/{name}/graphql` routing relative to the backend base; it is not app-owned `client.data`.

The adapter defaults to standalone, including in Node.js.
Only actual CLI callers set `host: { type: 'cli' }`; verified embedded callers set `host: { type: 'embedded' }`.
Put any connector-owned middleware/decoders in the adapter's `runtime` map, not the client deployment config.
See the [package-owned wiring example](https://github.com/microsoft/project-rayfin/blob/main/packages/typescript-sdk/connector-fabric-graphql/assets/docs/index.md#wire-the-client) for complete construction.
