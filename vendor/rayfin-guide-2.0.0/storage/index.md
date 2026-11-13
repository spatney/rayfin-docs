---
sidebar_position: 35
---

# Storage

Rayfin Storage provides typed folders for uploading, downloading, listing, and deleting files in a deployed Fabric Data App.

Storage is remote-only.

`rayfin dev` does not start a local Storage service or emulator.
With the default Fabric provider, `rayfin dev` automatically applies enabled Storage declarations to the remote backend.
Use `rayfin dev storage apply` to retry only Storage configuration.

## Install and enable Storage

To add Storage to an existing Rayfin app, run:

```bash
npx rayfin storage init
```

The command enables Storage and its required Data service, installs matching SDK dependencies, creates an owner-scoped `Attachment` starter folder and runtime schema, and wires declaration builds.
It only changes local project files: it does not authenticate, create a backend, or deploy folders.
Storage requires the Data service to be enabled but does not impose a database dialect restriction.
Initialization preserves an existing Data dialect and defaults a missing dialect to MSSQL.
See the [Data guide](../data/index.md) for database configuration and supported deployment options.

Single-package projects keep declarations under `rayfin/storage/`.
Workspace projects use a storage package selected from the workspace layout.
Automatic initialization currently supports npm projects; projects managed by another package manager should use the manual setup below.
Existing `services.storage.path` settings take precedence; the command never moves an existing service.
Use an explicit path to select the Storage declarations package:

```bash
npx rayfin storage init --path packages/storage
```

The path is a package root relative to the Rayfin project root, not a path to schema or client source files.
Storage packages outside the project root must be covered by the root package's npm workspaces so dependencies can be installed from the root.
Independent nested packages are rejected before any files are changed, including with `--skip-install` or `--dry-run`; add the package to npm workspaces or use the root package.
Existing package names, versions, scripts, dependencies, and custom fields are preserved when initialization adds Storage configuration.

Client package selection is automatic; there is no client-path override.
Pack-backed apps use the pack's frontend, including on reruns, and single-package apps use the root package.
Other npm workspace projects must have exactly one root or workspace package declaring `@microsoft/rayfin-client` in dependencies or devDependencies; that package receives `@microsoft/rayfin-storage`.
If no package or multiple packages declare the client, initialization fails before writing files or installing dependencies, including with `--skip-install` and `--dry-run`.
Use the [manual setup](#manual-setup) and [typed client guidance](#use-the-typed-client) for those layouts.

Existing SDK dependency declarations are preserved.
New SDK dependencies match the app's `@microsoft/rayfin-core` declaration, falling back to `@microsoft/rayfin-client` or `@microsoft/rayfin-storage` when core is not declared.
For local development with `file:` directory dependencies, initialization finds the required SDK by its package name among folders beside the matched package and rebases its path for the destination workspace.
If that sibling is unavailable or the matched package has conflicting declarations, initialization fails before writing files.
Initialization does not impose an additional cross-SDK version-range check; normal installation and declaration compilation still validate the resulting setup.

In scaffolded apps that provide the storage capability pack, initialization reuses it for initial setup, including typed client composition with functions and connectors.
Use the same initialization command regardless of how the app was created.
Re-running initialization preserves authored folders, schemas, and client code; it does not restore a starter folder you removed.
If a customized template client cannot be composed safely, the command fails with manual integration instructions rather than claiming storage is ready.
For other layouts, the command reports the remaining client integration explicitly.
Compose storage onto your existing authenticated client as described in [Use the typed client](#use-the-typed-client); do not create a second authentication session.
Keep the browser-safe folder map aligned with the runtime schema without importing decorated classes into browser code.

Preview changes or initialize without installing dependencies:

```bash
npx rayfin storage init --dry-run --output json
npx rayfin storage init --skip-install
```

Dry-run validates the local setup without writing files, installing packages, or contacting the backend.
`--skip-install` also skips declaration compilation; re-run without it to install and validate.
If an existing TypeScript configuration would omit the new Storage schema, initialization fails before changing files, including during dry-run or with `--skip-install`.
Update that configuration's `files`, `include`, or `exclude` settings as directed; initialization preserves authored compiler settings.
Normal initialization compiles registered Storage declarations and generates configuration before reporting success.
If installation fails, command-owned source changes are rolled back; installer-written lockfiles and `node_modules` may still need reconciliation before retrying.
Existing source files are never forcibly overwritten.

Storage initialization does not select a Fabric workspace or use ambient workspace targeting.
`--workspace`, `--workspace-id`, and `--env-file` are not initialization options; select deployment targets with `rayfin up`.
Declaration validation uses the storage package path resolved from the authored configuration and explicit initialization flags.
Dependency installers still inherit the shell environment, including npm registry and authentication settings.
Pressing Ctrl+C cancels initialization and its installer/compiler subprocesses.
If cancellation interrupts installation, reconcile installer-written lockfiles and `node_modules` before retrying.

### Manual setup

If configuring Storage manually, install the client package.

```bash
npm install @microsoft/rayfin-storage
```

Enable Data and Storage in `rayfin/rayfin.yml`.

```yaml
services:
  data:
    enabled: true
    dialect: mssql
  storage:
    enabled: true
```

Storage requires the Data service because folder configuration and object metadata use the deployed backend.
Storage can remain enabled before any folders are declared.
Rayfin applies Storage configuration only when at least one `@blob` folder is declared.
If no folders are declared, Storage apply is skipped with a warning.

## Declare folders

Import Storage declarations from `@microsoft/rayfin-core`.
This release removes the legacy Storage exports from `@microsoft/rayfin-core/experimental/index`; existing apps must move their Storage imports to the root entry point before rebuilding.
This applies to `blob`, `StorageObject`, `ContentTypes`, `bytes`, `kb`, `mb`, `gb`, and the types `BlobFolderOptions`, `ByteSize`, and `MimeGlob`.
Move only Storage imports; experimental auth claim imports remain on the experimental entry point.

Create decorated classes under `rayfin/storage/`.

```typescript
import {
  blob,
  ContentTypes,
  mb,
  role,
  StorageObject,
} from '@microsoft/rayfin-core';

@blob({
  name: 'profile-images',
  maxSize: mb(5),
  allowedContentTypes: [ContentTypes.AnyImage],
})
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class ProfileImages extends StorageObject {}
```

Every folder needs an authenticated permission rule.

Anonymous Storage permissions are not supported.

Object paths help organize files, but the folder policy is the authorization boundary.

Register each deployable folder in `rayfin/storage/schema.ts`.

```typescript
import { ProfileImages } from './ProfileImages.js';

export type AppStorageSchema = {
  'profile-images': ProfileImages;
};

export const schema = [ProfileImages];
```

The runtime `schema` array is authoritative.

Rayfin does not apply decorated `@blob` classes that are not registered in this array.

## Deploy folders

Deploy the application and apply all enabled services.

```bash
npx rayfin up
```

Use the Storage-only command when retrying configuration or deploying only folder changes.

```bash
npx rayfin up storage apply
```

During a Fabric-backed development session, Storage is applied automatically.
Retry only Storage configuration with:

```bash
npx rayfin dev storage apply
```

The retry command requires an existing Fabric backend that has already been initialized by the full `rayfin dev` workflow.
It does not create a backend or apply unrelated service settings.
It applies to the active deployment and rejects `--workspace` and `--workspace-id`; run full `rayfin dev` first when you need to select another workspace.

The development command rejects `--provider docker` because Storage has no local backend.

Removing a folder declaration makes the folder unavailable as soon as the apply succeeds and permanently deletes every object and its metadata in the background.
Deleted folders cannot be restored, and the folder name cannot be reused until background cleanup finishes.
Applying the removal of a non-empty folder requires `--force`.
Removing the final folder declaration does not remove a previously deployed folder because empty Storage configurations are not applied.

## Use the typed client

Compose the separately installed Storage client through the stable Rayfin client API.

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { storageService } from '@microsoft/rayfin-storage';
import type { AppStorageSchema } from '../rayfin/storage/schema';

const client = RayfinClient.create({
  baseUrl,
  publishableKey,
  auth: browserSession(),
  services: {
    storage: storageService<AppStorageSchema>(),
  },
});

await client.storage['profile-images'].upload('users/42/avatar.png', file);
const result = await client.storage['profile-images'].download(
  'users/42/avatar.png'
);
```

Read the `@microsoft/rayfin-storage` package documentation for complete operation options, result types, and error codes.
