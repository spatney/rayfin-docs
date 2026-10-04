---
sidebar_position: 75
---

# Deprecation Warnings

Rayfin may emit deprecation warnings when your application uses an API or option that will change in a future release.
Warnings are printed with `console.warn` and include a stable code such as `[RAYFIN_DEP_USE_PROXY]` so you can search for the affected usage.

## Silence warnings in application code

Use `setDeprecationsSilenced(true)` when you have reviewed the warnings and want to hide them for a specific environment.
Import the setting from `@microsoft/rayfin-client` and call it early in application startup before creating Rayfin clients or using deprecated APIs.

```ts
import { setDeprecationsSilenced } from '@microsoft/rayfin-client';

setDeprecationsSilenced(true);
```

You can call `setDeprecationsSilenced(false)` to enable warnings again.
Use `isDeprecationSilenced()` when you need to check the current setting.

```ts
import { isDeprecationSilenced } from '@microsoft/rayfin-client';

console.log(isDeprecationSilenced());
```

## Silence warnings in Node.js

For Node.js scripts, tests, or server-side tools, set `RAYFIN_NO_DEPRECATION` to `1` or `true`.

```bash
RAYFIN_NO_DEPRECATION=1 npm run dev
```

## Browser apps

Browser environments do not provide the Node.js environment variable that Rayfin checks.
Use the programmatic toggle in browser apps, and call it during startup before code paths that could emit deprecation warnings.
