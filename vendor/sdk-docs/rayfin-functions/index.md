---
symbols:
  - FunctionClient
  - FunctionClient.invoke
  - FunctionsError
  - createFunctionsApi
  - InvokeOptions
  - FunctionInvocationResponse
  - FunctionsSchema
  - TypedFunctionClients
---

# @microsoft/rayfin-functions

[![npm version](https://badge.fury.io/js/%40microsoft%2Frayfin-functions.svg)](https://badge.fury.io/js/%40microsoft%2Frayfin-functions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-blue.svg)](https://www.typescriptlang.org/)

Type-safe client library for invoking Rayfin user-defined functions with strongly-typed inputs and outputs.
Most applications access it through `client.functions.<name>.invoke()` on `RayfinClient`.
This package invokes functions; server-side authoring belongs to `@microsoft/fabric-user-data-functions`.

## Installation

```bash
npm install @microsoft/rayfin-functions
```

## API summary

| Export | Purpose |
| --- | --- |
| `FunctionClient<TInput, TOutput>` | Client for one named function; constructed with `(apiClient, functionName)`. |
| `FunctionsError` | Invocation error extending `SdkError`, with a message and error code. |
| `createFunctionsApi<TSchema>(apiClient)` | Creates typed, lazily cached clients for the function names in a schema. |
| `InvokeOptions` | Per-call `headers` and `timeoutMs` options. |
| `FunctionInvocationResponse<TOutput>` | Transport envelope containing status, output, errors, and invocation ID; **not** the return type of `invoke()`. |
| `FunctionsSchema` | Maps each function name to its `input` and `output` types. |
| `TypedFunctionClients<TSchema>` | Maps a schema to its typed `FunctionClient` properties. |

## Invocation contract

`invoke(params, options?)` returns `Promise<TOutput>`: the output value directly, not an object with an `output` property.
For a no-input function, use `invoke()` or `invoke(undefined, options)`.
Options always occupy the second argument.

`timeoutMs` defaults to 250,000 ms and is capped at that value.
A positive, finite value below the cap shortens the timeout; other invalid values use the default.
Extra request headers are supplied through `headers`.

A non-success response or a non-empty `errors` array throws `FunctionsError` with code `FUNCTION_EXECUTION_ERROR`.
Network and SDK errors propagate unchanged; unexpected errors use `UNKNOWN_FUNCTION_ERROR`.
Schemas provide compile-time types, not runtime validation.

## Guides

See the [Functions guide](/docs/guide/functions/), [frontend invocation walkthrough](/docs/guide/functions/invoking-from-frontend), and [type generation guide](/docs/guide/functions/typegen) for how-to instructions.

## License

Copyright (c) Microsoft Corporation. Licensed under the MIT License.
