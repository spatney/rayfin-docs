---
name: rayfin-storage
description: "Use only when the user explicitly requests experimental Rayfin Storage or the project already enables it. Triggers: Rayfin Storage, @microsoft/rayfin-storage, @blob, StorageObject, StorageClient, StorageFolderClient, createStorageClient, rayfin/storage, rayfin dev storage apply, rayfin up storage apply"
metadata:
  author: microsoft
  version: "0.1.0"
---

# Rayfin Storage

Rayfin Storage is experimental.
Do not select or suggest it for a generic file-upload request unless the user explicitly names Rayfin Storage or the project already enables `services.storage.enabled`.

## Bootstrap

If `@microsoft/rayfin-storage` is missing, install the version compatible with the project's Rayfin packages before writing Storage code.

Enable Storage in `rayfin/rayfin.yml`:

```yaml
services:
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

- Import `blob`, `StorageObject`, `ContentTypes`, and byte-size helpers from `@microsoft/rayfin-core/experimental` while Storage remains experimental.
- Give every folder at least one authenticated permission decorator; configuration apply rejects folders with no rules, and anonymous Storage permissions are unsupported.
- Treat authorization policies as the security boundary; prefixes organize paths but do not grant access.
- Omit `prefix` by default. Add it only when the user explicitly requires path partitioning or the existing application design establishes one; never derive a user-ID prefix merely because authentication is available. If the requirement is unclear, keep the object at the folder root and tell the user that no prefix was added.
- Keep an explicit `@blob({ name })` value aligned with its Storage schema key.
- Send decorated application metadata through `upload({ fields })`; intrinsic object fields are server-managed.
- Access listed custom fields at the top level because the SDK flattens the service's `fields` envelope.
- Use the typed Storage client rather than constructing Storage HTTP or SAS requests directly.

## Commands

```bash
npm install @microsoft/rayfin-storage  # Install the SDK separately
npx rayfin dev storage apply           # Apply folder configuration locally
npx rayfin up                          # Deploy and apply enabled services
npx rayfin up storage apply            # Re-apply cloud Storage configuration only
```

Use `--force` only after reviewing and accepting destructive configuration changes.
