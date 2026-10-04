---
symbols: ['createStorageClient', 'StorageApi', 'StorageClient', 'StorageFolderClient', 'StorageSchema', 'StorageObjectRef', 'StorageError', 'StorageErrorCode', 'UploadOptions', 'DownloadOptions', 'ListOptions', 'DeleteOptions', 'isStorageError', 'STORAGE_ERROR_CODES']
---

# @microsoft/rayfin-storage

> **Experimental.**
>
> This package and the `@blob()` decorator that drives it are experimental.
> Their APIs may change or be removed without a major-version bump.

`@microsoft/rayfin-storage` is the type-safe client SDK for uploading, downloading, listing, and deleting objects in Rayfin storage folders.

## Install and enable storage

Install the storage client in the application that uses it.

```bash
npm install @microsoft/rayfin-storage
```

Enable the storage service in `rayfin/rayfin.yml`.

```yaml
services:
  storage:
    enabled: true
```

The CLI only generates and applies storage configuration when `services.storage.enabled` is `true`.

## Declare a storage folder

Declare storage folders under `rayfin/storage/` with `@blob()` from `@microsoft/rayfin-core/experimental`.

Extend `StorageObject` when a policy references intrinsic object fields such as `owner_id`.

```typescript
import { role } from '@microsoft/rayfin-core';
import {
  blob,
  ContentTypes,
  mb,
  StorageObject,
} from '@microsoft/rayfin-core/experimental';

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

Compose the storage service through `ExtendableRayfinClient`.

```typescript
import type { RayfinClient } from '@microsoft/rayfin-client';
import { ExtendableRayfinClient } from '@microsoft/rayfin-client/experimental';
import {
  createStorageClient,
  type StorageClient,
} from '@microsoft/rayfin-storage';

import type { AppSchema } from '../../../rayfin/data/schema.js';
import type { AppStorageSchema } from '../../../rayfin/storage/schema.js';

export type AppClient = RayfinClient<AppSchema> & {
  storage: StorageClient<AppStorageSchema>;
};

export function createAppClient(
  baseUrl: string,
  publishableKey: string
): AppClient {
  return ExtendableRayfinClient.create({
    baseUrl,
    publishableKey,
    schema: {} as AppSchema,
    services: {
      storage: createStorageClient<AppStorageSchema>,
    },
  });
}
```

The storage proxy maps each schema key directly to a typed `StorageFolderClient`.

## Implement a profile-image service

Use a stable object name to make replacement deterministic and use the signed-in user ID as the prefix to isolate each user's object path.

This service deliberately opts into per-user path partitioning.
Prefixes are not required for authenticated objects and must not be added merely because a user ID is available.

The ownership policy remains the authorization boundary because prefixes alone are not authorization.

```typescript
import type { StorageClient } from '@microsoft/rayfin-storage';

import type { AppStorageSchema } from '../../../rayfin/storage/schema.js';

export class ProfileImageService {
  constructor(private readonly storage: StorageClient<AppStorageSchema>) {}

  async upload(userId: string, file: File) {
    return this.storage.ProfileImage.upload('profile-image', file, {
      prefix: userId,
    });
  }

  async list(userId: string) {
    return this.storage.ProfileImage.list({ prefix: userId, limit: 20 });
  }

  async download(userId: string, name = 'profile-image') {
    return this.storage.ProfileImage.download(name, { prefix: userId });
  }

  async remove(userId: string, name = 'profile-image') {
    return this.storage.ProfileImage.delete(name, { prefix: userId });
  }
}
```

Use the authenticated session's subject identifier for `userId` rather than accepting an arbitrary user ID from untrusted input.

To display a downloaded image in a browser, convert its stream into a `Blob` and revoke the object URL when it is replaced or no longer used.

```typescript
const result = await profileImages.download(userId);
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

Apply folder declarations to local development after changing `rayfin/storage/`.

```bash
npx rayfin dev storage apply
```

`rayfin up` automatically applies storage configuration when storage is enabled.

The explicit cloud command remains available for retries or storage-only changes.

```bash
npx rayfin up storage apply
```

Use `--force` only when accepting destructive storage configuration changes.

## Operation options and results

Every operation accepts an options object with an optional `signal`.

- `upload(name, data, options)` supports `prefix`, optional content metadata, SAS expiry, and typed `fields`.
- `download(name, options)` supports `prefix` and SAS expiry.
- `list(options)` supports `prefix`, `limit`, and `continuation` pagination.
- `delete(name, options)` supports `prefix` and waits for the durable delete operation to finish.

`upload()` returns `{ object, correlationId }`.

Omit `prefix` by default to store the object at the folder root.

```typescript
await storage.documents.upload(file.name, file);
```

Add `prefix` only when the application explicitly requires path partitioning, and use the same prefix for later download and delete operations.
Do not derive a user-ID prefix solely because the caller is authenticated.

Upload options control stored HTTP metadata and the temporary upload URL:

- `contentType` overrides the MIME type inferred from `Blob` or `File` data.
  Other data defaults to `application/octet-stream`.
- `contentDisposition` controls the stored content-disposition metadata, such as whether content should be displayed inline or downloaded.
- `cacheControl` sets the caching policy chosen by the application for the folder's content and access model.
- `expiresInSeconds` requests the lifetime of the temporary SAS URL used to upload bytes directly to OneLake.
  It does not control the lifetime of the stored object, and the service clamps it to the allowed range.

The following upload stores explicit response metadata and requests a five-minute upload URL.

```typescript
await storage.documents.upload('report.pdf', pdfBytes, {
  prefix: userId,
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
import { role, text } from '@microsoft/rayfin-core';
import { blob, StorageObject } from '@microsoft/rayfin-core/experimental';

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

await storage.TeamDocument.upload('plan.pdf', file, {
  prefix: teamId,
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
