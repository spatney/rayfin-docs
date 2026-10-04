---
sidebar_position: 4
---

# Invoking functions from the frontend

Functions are called through `RayfinClient`. Pass your generated `AppFunctionsSchema` as the client's second type argument so every call is type-checked.

```ts
import { RayfinClient } from "@microsoft/rayfin-client";
import type { AppSchema } from "../rayfin/data/schema";
import type { AppFunctionsSchema } from "../rayfin/functions/src/types.js";

const client = new RayfinClient<AppSchema, AppFunctionsSchema>({
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
});

// Type-safe: parameters and return type are checked against the schema.
const greeting = await client.functions.greet.invoke({
  firstName: "Jane",
  lastName: "Doe",
});

// For functions whose only parameter is RayfinContext, the input is `Record<string, never>`:
const entries = await client.functions.getEntries.invoke();
```

The exact import path for `AppFunctionsSchema` depends on where your frontend lives relative to `rayfin/functions/src/types.ts`.

## Invocation behavior

- `invoke()` resolves to the function's output directly (typed as the schema's `output`) — not an envelope. By the time it resolves you can use the value without checking for `undefined`.
- On failure it **throws**: a non-empty `errors` array or a non-success status becomes a `FunctionsError`; network problems surface as a `NetworkError`.
- The server-side `invocationId` is emitted via `console.debug` for correlation with backend telemetry.

### Per-call options

Options always go in the **second** argument slot; the first argument is always the input:

```ts
// Input function with a per-call timeout:
await client.functions.longRunning.invoke(params, { timeoutMs: 5_000 });

// No-input function — pass `undefined` first, then options:
await client.functions.ping.invoke(undefined, { timeoutMs: 5_000 });
```

`timeoutMs` is clamped to the Fabric UDF host ceiling of 250 seconds (`FUNCTIONS_INVOKE_TIMEOUT_MS`), since the host aborts any invocation at that limit regardless of the client value.

## Local development

By default, invocations route to your deployed backend.
Bundled Vite templates use `@microsoft/rayfin-local-dev` to keep local function calls on the frontend origin.
During `vite serve`, the client calls `/.rayfin/api/<name>` and the adapter forwards the request to the exact Functions host selected by `npx rayfin dev`.

For a custom or older Vite project, install the adapter:

```bash
npm install @microsoft/rayfin-local-dev
```

Register it in `vite.config.ts`:

```ts
import { rayfinLocalDev } from "@microsoft/rayfin-local-dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [rayfinLocalDev()],
});
```

Then resolve the local base URL when you create the client:

```ts
import { resolveRayfinFunctionsBaseUrl } from "@microsoft/rayfin-local-dev";

const client = new RayfinClient<AppSchema, AppFunctionsSchema>({
  publishableKey: import.meta.env.VITE_RAYFIN_PUBLISHABLE_KEY,
  functionsBaseUrl: resolveRayfinFunctionsBaseUrl(),
});
```

The helper returns an absolute `/.rayfin` URL on the current browser origin only when the Vite adapter has registered local Functions routing.
In production it returns `undefined`, so calls use the deployed Fabric backend.
If the local Functions host becomes unavailable while the adapter is active, the proxy returns HTTP 502 instead of falling back to deployed function code.
The proxy is reachable wherever the Vite development server is reachable, so keep Vite bound to loopback or restrict its `host` and `allowedHosts` settings to a trusted development network.

`npx rayfin dev` starts the frontend and Functions host together and supplies the selected Functions URL to the adapter.
`npx rayfin dev functions apply` starts only the Functions host; start your Vite frontend separately to use the same-origin route.
See [`npx rayfin dev functions apply`](../cli/functions/dev-apply.md) for the local debugging workflow.

For frameworks other than Vite, pass the framework-mapped Functions URL directly during development and leave `functionsBaseUrl` undefined in production.
For example, use `NEXT_PUBLIC_RAYFIN_FUNCTIONS_URL` with an explicit development guard in Next.js.
