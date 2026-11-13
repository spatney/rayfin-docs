---
name: rayfin-storage
description: 'Use for Rayfin file and blob storage tasks. Triggers: Rayfin Storage, @microsoft/rayfin-storage, @blob, StorageObject, StorageClient, StorageFolderClient, createStorageClient, rayfin/storage, rayfin storage init, rayfin up storage apply, rayfin dev storage apply'
metadata:
  author: microsoft
  version: '1.0.0'
---

# Rayfin Storage

Rayfin Storage is generally available for deployed Microsoft Fabric backends.

Storage is remote-only.

Do not create a local Storage emulator workflow.
The default Fabric-backed `rayfin dev` session applies enabled Storage declarations automatically.
`rayfin dev storage apply` retries the remote apply and must not be used with `--provider docker`.

## Bootstrap

Before installing packages or writing Storage declarations or client code, inspect `rayfin/rayfin.yml`.
If `services.data.enabled` is not `true`, stop and ask whether to enable Data and Storage together.
Explain that Storage requires Data because folder configuration and object metadata use the deployed database.
Do not enable Data or proceed with the Storage implementation until the user confirms.

After the user has approved the required services, prefer `npx rayfin storage init` over manually reconstructing the bootstrap steps.
Use this entry point regardless of how the app was created; do not require the user to choose a template-specific bootstrap command.
It enables Data and Storage, installs matching packages, creates registered owner-scoped starter declarations, and wires declaration builds without deploying.
Use `--dry-run --output json` to inspect the plan and `--path` to select the Storage declarations package.
Client selection is automatic: use the pack's frontend for pack-backed apps, the root for single-package apps, or the sole root/workspace package declaring `@microsoft/rayfin-client` for custom npm workspaces.
Custom workspaces with no client owner or multiple owners fail before any writes, even with `--skip-install` or `--dry-run`; follow the version-matched docs for manual setup rather than guessing an owner.
There is no client-path override.
The command currently supports npm projects and preserves the existing Data dialect, defaulting to MSSQL only when no dialect is configured.
Storage requires Data to be enabled; leave dialect selection and validation to the Data workflow and its version-matched docs.
When the app provides the supported storage capability pack, initialization reuses it and preserves authored files.
Do not treat an explicit manual client integration requirement or a preserved customized client as ready-to-use Storage.
Merge storage onto the existing authenticated client, keep its browser-safe folder map aligned with the runtime schema, and re-run initialization.

For manual setup, install a compatible `@microsoft/rayfin-storage` version and enable Data and Storage in `rayfin/rayfin.yml`:

```yaml
services:
  data:
    enabled: true
  storage:
    enabled: true
```

## Version-matched documentation

Read `node_modules/@microsoft/rayfin-storage/package.json`, resolve `rayfinDocs.dir`, and read its `index.md` before changing Storage declarations or client code.
If direct file access is unavailable, use `rayfin docs get --module rayfin-storage --path index.md` or the equivalent Rayfin MCP `get_doc` call.

Storage folders use Core's shared `@role()` decorator and policy DSL.
Read `node_modules/@microsoft/rayfin-core/assets/docs/permissions.md` for that API.
Do not infer operation signatures, decorator options, result shapes, or error codes from this skill.

## Guardrails

- Import `blob`, `StorageObject`, `ContentTypes`, and byte-size helpers from `@microsoft/rayfin-core`.
- This release removes the legacy Storage exports from `@microsoft/rayfin-core/experimental/index`; migrate existing Storage imports, including `BlobFolderOptions`, `ByteSize`, and `MimeGlob`, to the root entry point. Leave experimental auth claim imports unchanged.
- Storage can remain enabled before folders are declared. If no `@blob` folders are declared, explain that Storage apply is skipped with a warning; do not tell the user to disable Storage.
- Give every folder at least one authenticated permission decorator; configuration apply rejects folders with no rules, and anonymous Storage permissions are unsupported.
- Treat authorization policies as the security boundary; path segments organize objects but do not grant access.
- Use a bare file name by default. Add directory segments to the object path only when the user explicitly requires path partitioning or the existing application design establishes one; never derive a user-ID segment merely because authentication is available. If the requirement is unclear, keep the object at the folder root and tell the user that no directory segments were added.
- Keep an explicit `@blob({ name })` value aligned with its Storage schema key.
- Register every folder intended for deployment in the runtime `schema` array exported from `rayfin/storage/schema.ts`; unregistered `@blob` classes are not applied.
- Treat `rayfin dev storage apply` as a retry for a Fabric backend already initialized by full `rayfin dev`; it does not provision the backend or synchronize other service settings.
- Run `rayfin dev storage apply` only against the active deployment; the command rejects `--workspace` and `--workspace-id`, so use full `rayfin dev` first to select another workspace.
- Send decorated application metadata through `upload({ fields })`; intrinsic object fields are server-managed.
- Access listed custom fields at the top level because the SDK flattens the service's `fields` envelope.
- Use the typed Storage client rather than constructing Storage HTTP or SAS requests directly.

## Commands

Storage configuration is applied to the deployed Fabric backend.

```bash
npx rayfin storage init                # Initialize local sources and dependencies
npx rayfin up                          # Deploy and apply enabled services
npx rayfin up storage apply            # Re-apply cloud Storage configuration only
npx rayfin dev storage apply           # Retry Storage for the Fabric dev backend
```

Removing a folder declaration makes the folder unavailable as soon as the apply succeeds and permanently deletes every object and its metadata in the background.
Deleted folders cannot be restored, and the folder name cannot be reused until background cleanup finishes.
Removing the final folder declaration does not remove a previously deployed folder because empty Storage configurations are not applied.
Never suggest or pass `--force` unless the user has reviewed and explicitly accepted that data loss.
