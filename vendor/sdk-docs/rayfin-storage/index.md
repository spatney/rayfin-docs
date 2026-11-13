---
symbols:
  [
    'storageService',
    'createStorageClient',
    'StorageApi',
    'StorageClient',
    'StorageFolderClient',
    'StorageSchema',
    'StorageObjectRef',
    'StorageError',
    'StorageErrorCode',
    'UploadOptions',
    'DownloadOptions',
    'ListOptions',
    'DeleteOptions',
    'isStorageError',
    'STORAGE_ERROR_CODES',
  ]
---

# @microsoft/rayfin-storage

`@microsoft/rayfin-storage` is the type-safe client SDK for uploading, downloading, listing, and deleting objects in Rayfin storage folders.

Storage is remote-only and operates against a deployed Microsoft Fabric backend.

`rayfin dev` does not start a local Storage service or emulator.
With the default Fabric provider, it applies enabled Storage declarations to the remote development backend.

## Install and enable storage

To add Storage to an existing npm-based Rayfin app, run:

```bash
npx rayfin storage init
```

The command enables the required services, installs dependencies, creates registered starter declarations, and validates them without deploying.
See the [Storage bootstrap guide](https://microsoft.github.io/rayfin/docs/guide/storage/#install-and-enable-storage) for layout selection, previews, and client integration.
The same guide is available through the docs CLI and MCP by looking up `storage/index.md` in the `guide` module.

### Manual setup

If configuring Storage manually, install the storage client in the application that uses it.

```bash
npm install @microsoft/rayfin-storage
```

Enable the Data and Storage services in `rayfin/rayfin.yml`.

```yaml
services:
  data:
    enabled: true
    dialect: mssql
  storage:
    enabled: true
```

Storage requires the Data service because folder configuration and object metadata use the deployed database.
The CLI only generates and applies storage configuration when `services.storage.enabled` is `true`.
Rayfin applies Storage configuration only when at least one `@blob` folder is declared.
If no folders are declared, Storage apply is skipped with a warning.

`rayfin dev storage apply` is a retry command for a Fabric backend already initialized by the full `rayfin dev` workflow.
It does not create a backend or apply unrelated service settings.
It applies to the active deployment and rejects `--workspace` and `--workspace-id`.

## Declare a storage folder

Declare storage folders under `rayfin/storage/` with `@blob()` from `@microsoft/rayfin-core`.

This release removes the legacy Storage exports from `@microsoft/rayfin-core/experimental/index`.
Move `blob`, `StorageObject`, `ContentTypes`, byte-size helpers, and their Storage option types to imports from `@microsoft/rayfin-core`; the old imports no longer compile.
Leave experimental auth claim imports on the experimental entry point.

Extend `StorageObject` when a policy references intrinsic object fields such as `owner_id`.

```typescript
import {
  blob,
  ContentTypes,
  mb,
  role,
  StorageObject,
} from '@microsoft/rayfin-core';

@blob({
  onConflict: 'overwrite',
  maxSize: mb(5),
  allowedContentTypes: [ContentTypes.AnyImage],
})
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class ProfileImage extends StorageObject {}
```

`StorageObject` is declaration-only and adds no application metadata fields.

The server manages intrinsic fields such as `owner_id`, `id`, `path`, `size`, and `etag`.

The folder options are:

- `name` sets an explicit folder name and otherwise defaults to the normalized class name.
- `onConflict` defaults to `'error'` and may be set to `'overwrite'` when an authorized role has `update` permission.
- `allowedContentTypes` accepts MIME patterns such as `'image/*'` or constants from `ContentTypes`.

Every folder requires at least one authenticated permission rule declared with the same `@role()` decorator used by data entities.
Storage configuration rejects folders with no rules, and anonymous Storage permissions are not supported.

## Register the storage schema

Map each folder key to its decorated class and export the classes as the runtime schema.

```typescript
import { ProfileImage } from './ProfileImage.js';

export type AppStorageSchema = {
  ProfileImage: ProfileImage;
};

export const schema = [ProfileImage];
```

The runtime `schema` array is authoritative for deployment.

Rayfin ignores decorated `@blob` classes that are not registered in this array.

Do not intersect schema values with `StorageObjectRef`.

The client adds the `StorageObjectRef` response envelope automatically.

### Explicit folder names

When `@blob()` supplies `name`, the schema key must be that exact configured name.

```typescript
@blob({ name: 'profile-images' })
export class ProfileImages extends StorageObject {}

export type AppStorageSchema = {
  'profile-images': ProfileImages;
};

export const schema = [ProfileImages];
```

Use bracket notation for a key containing a hyphen.

```typescript
client.storage['profile-images'].list();
```

Do not use `ProfileImages` as the schema key when the configured name is `profile-images`.

## Add storage to a Rayfin client

Compose storage with `storageService` on the unified client.

```typescript
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { dataService } from '@microsoft/rayfin-data';
import { storageService } from '@microsoft/rayfin-storage';

import type { AppSchema } from '../../../rayfin/data/schema.js';
import type { AppStorageSchema } from '../../../rayfin/storage/schema.js';

export function createAppClient(baseUrl: string, publishableKey: string) {
  return RayfinClient.create({
    baseUrl,
    publishableKey,
    auth: browserSession(),
    services: {
      data: dataService<AppSchema>(),
      storage: storageService<AppStorageSchema>(),
    },
  });
}

export type AppClient = ReturnType<typeof createAppClient>;
```

The storage proxy maps each schema key directly to a typed `StorageFolderClient`.
The adapter reuses `createStorageClient`, which remains public, and shares the authenticated transport with data and other registered services.
Disposing the client releases its resources without signing out or deleting persisted credentials.

## Use object paths

Specify the entire relative path of the storage object, including its file name.

Use `/` to separate file path segments.
Pass the same object path to `upload()`, `download()`, and `delete()`.
Pass the file path without an object name to `list()`.
Call `list()` without arguments to list from the storage folder root.

```typescript
const objectPath = 'profiles/avatars/photo.png';

await client.storage['profile-images'].upload(objectPath, file);
await client.storage['profile-images'].download(objectPath);
await client.storage['profile-images'].delete(objectPath);
await client.storage['profile-images'].list();
await client.storage['profile-images'].list('profiles/avatars', { limit: 20 });
```

Object paths are relative to the declared storage folder.
Object paths are not an authorization boundary; the folder's `@role()` policy determines whether the current session can access an object.
When partitioning object paths by user, derive the user-specific segment from the authenticated session's subject identifier rather than accepting an arbitrary user ID from untrusted input.
A root-level object uses only its file name, such as `photo.png`.
Do not start or end a path with `/`, use empty segments, or use `.` or `..` as a segment.
Backslashes are not path separators and are rejected.
Other characters and casing are preserved by the SDK.

To display a downloaded image in a browser, convert its stream into a `Blob` and revoke the object URL when it is replaced or no longer used.

```typescript
const result = await client.storage['profile-images'].download(
  'profiles/avatars/photo.png'
);
const blob = await new Response(result.stream, {
  headers: result.contentType
    ? { 'Content-Type': result.contentType }
    : undefined,
}).blob();
const objectUrl = URL.createObjectURL(blob);

// Assign objectUrl to an image element, then clean it up later.
URL.revokeObjectURL(objectUrl);
```

## Apply storage configuration

Storage configuration is remote-only and applies to the deployed Fabric backend.
`rayfin up` automatically applies folder declarations when Storage is enabled.

The explicit cloud command remains available for retries or storage-only changes.

```bash
npx rayfin up storage apply
```

Removing a folder declaration makes the folder unavailable as soon as the apply succeeds and permanently deletes every object and its metadata in the background.
Deleted folders cannot be restored, and the folder name cannot be reused until background cleanup finishes.
Applying the removal of a non-empty folder requires `--force`.
Removing the final folder declaration does not remove a previously deployed folder because empty Storage configurations are not applied.

## Operation options and results

Every operation accepts an options object with an optional `signal`.

- `upload(path, data, options)` supports optional content metadata, SAS expiry, and typed `fields`.
- `download(path, options)` supports SAS expiry.
- `list(directoryPath, options)` supports an optional directory path, `limit`, and `continuation` pagination.
- `delete(path, options)` waits for the durable delete operation to finish.

`upload()` returns `{ object, correlationId }`.

Pass only a file name to store the object at the folder root.

```typescript
await storage.documents.upload(file.name, file);
```

Include the entire relative object path when storing a file in a directory.
Use the same path for later download and delete operations.

Upload options control stored HTTP metadata and the temporary upload URL:

- `contentType` overrides the MIME type inferred from `Blob` or `File` data.
  Other data defaults to `application/octet-stream`.
- `contentDisposition` controls the stored content-disposition metadata, such as whether content should be displayed inline or downloaded.
- `cacheControl` sets the caching policy chosen by the application for the folder's content and access model.
- `expiresInSeconds` requests the lifetime of the temporary SAS URL used to upload bytes directly to OneLake.
  It does not control the lifetime of the stored object, and the service clamps it to the allowed range.

The following upload stores explicit response metadata and requests a five-minute upload URL.

```typescript
await storage.documents.upload('reports/2026/report.pdf', pdfBytes, {
  contentType: 'application/pdf',
  contentDisposition: 'inline',
  cacheControl: 'private, max-age=3600',
  expiresInSeconds: 300,
});
```

`download()` returns a `ReadableStream` plus available content headers and `correlationId`.
Its `contentDisposition` value is the header returned by OneLake, or `undefined` when OneLake omits the header; the SDK does not override or synthesize it during download.

`list()` returns `{ items, continuation, correlationId }`.

The SDK flattens each item's server-provided `fields` onto the returned object.
Custom metadata is therefore available directly, such as `item.team_id`.
Custom metadata properties are optional because an individual object may not contain every field declared by its folder schema.

Pass a returned `continuation` into the next `list()` call to fetch another page.

`delete()` returns `{ success, deleted, correlationId }` after deletion completes.

### Data-plane behavior

- `upload()` opens an asynchronous upload operation, polls until a write SAS URL is available, transfers bytes directly to storage, commits the upload, and waits for the operation to succeed.
- `download()` requests a read SAS URL after the service authorizes access, then returns the direct storage response as a `ReadableStream` with available content headers.
- `list()` calls `GET api/storage/list` with the folder, prefix, continuation, and limit as query parameters.
- `delete()` calls `DELETE api/storage/delete` with the folder, file name, and optional prefix in the JSON body, then polls `GET api/storage/operations/{id}/status` until the operation succeeds or fails.

Upload, download, list, and delete use one `correlationId` across every network leg in the operation and return that ID to the caller.

Terminal asynchronous operation failures throw a `StorageError`.

## Typed application metadata

Decorated fields on the folder class become typed application metadata.

Send values through `upload({ fields })` when a folder declares them.

```typescript
import { blob, role, StorageObject, text } from '@microsoft/rayfin-core';

@blob()
@role('authenticated', '*', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class TeamDocument extends StorageObject {
  @text({ max: 100 })
  team_id!: string;
}

type TeamStorageSchema = {
  TeamDocument: TeamDocument;
};

await storage.TeamDocument.upload(`${teamId}/plan.pdf`, file, {
  fields: { team_id: teamId },
  contentType: 'application/pdf',
});
```

Intrinsic `StorageObject` fields are server-managed and must not be supplied in `fields`.

## Error handling

Storage failures throw a `StorageError` with `code`, `status`, `correlationId`, and `retryable` properties.

Use `isStorageError` to narrow unknown failures.

```typescript
import { isStorageError } from '@microsoft/rayfin-storage';

try {
  await storage.ProfileImage.upload('profile-image', file, {
    contentType: file.type,
  });
} catch (error) {
  if (!isStorageError(error)) {
    throw error;
  }

  switch (error.code) {
    case 'Conflict':
      // The object exists and overwrite was not requested or permitted.
      break;
    case 'TooLarge':
      // The object exceeds the folder or service limit.
      break;
    case 'UnsupportedContentType':
      // The MIME type is not allowed by the folder.
      break;
    case 'PermissionDenied':
    case 'Unauthenticated':
      // The current session cannot perform this operation.
      break;
    case 'NotFound':
      // The folder or object does not exist.
      break;
    case 'Aborted':
      // The supplied AbortSignal was aborted.
      break;
    default:
      if (error.retryable) {
        // A new invocation may be attempted after backoff.
      }
  }
}
```

The SDK does not automatically retry a failed multi-step operation.

The complete stable code set is exported as `STORAGE_ERROR_CODES`.
