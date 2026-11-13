---
sidebar_position: 2
---

# Connector additional payload

> [!WARNING]
> `additionalPayload` is experimental.
> The CLI saves it with your connector settings, but it affects an invocation only when the deployed backend accepts it for that connector and the connector's runtime implements behavior for it.
> No connector defines an `additionalPayload` contract yet.

`additionalPayload` is an optional JSON object you can declare in `rayfin.yml` under a Category B (function-bridge) connector that supports it.
Rayfin saves it with the connector's runtime settings and the host delivers it to that connector's runtime, separately from the input a caller sends with each invocation.

The connector defines what the object means.
Rayfin does not add keys, apply defaults, or merge its contents into other connector settings, and it has no shared schema for it.
A key the connector does not support has no effect, or is rejected by the connector.

## Supported connectors

A connector accepts `additionalPayload` only when both of these are true:

- **The CLI admits it.**
  In this release, the connector must be a Category B (function-bridge) connector.
- **The deployed backend accepts it.**
  The backend accepts it only for connector types that explicitly support it, and only where that support is enabled for your tenant or workspace.

Category B is required but not enough: not every Category B connector supports `additionalPayload`.
Initially, `eventhouse` is the only connector type that supports it.
Other Category B types, such as `fabric-semanticmodel`, pass CLI validation but are rejected when you deploy.

It is not supported for Category A (GraphQL entity) connectors in this release: `fabric-sqlanalytics`, `fabric-warehouse`, and `fabric-sqldatabase`.

Declaring it on a Category A connector, even as `additionalPayload: {}`, is an error.
`npx rayfin up`, `npx rayfin up connector apply`, and `npx rayfin dev` report it before creating, generating, or deploying anything, and nothing is saved.
Remove the key from that connector to continue; its entities, GraphQL configuration, and client behavior are unchanged.

### When the backend rejects it

The deployed backend decides, not the CLI.
Passing CLI validation, including `npx rayfin up --dry-run`, does not mean a deployment will accept `additionalPayload`.

When the backend rejects it, `npx rayfin up` fails at the runtime settings step and shows the backend's error.
It stops before deploying data, storage, connector configuration, static content, or functions.
Earlier steps, such as creating the Rayfin item, are not undone.
`npx rayfin dev` against a Fabric backend fails the same way before starting the session.

The CLI never removes the object, retries without it, or reports a successful deployment after a rejection.
Remove `additionalPayload` from that connector, then run the command again.

### When the backend doesn't support it yet

A backend released before `additionalPayload` support ignores the object instead of rejecting it, and still saves the rest of the settings.
To catch this, the CLI reads the settings back after saving them and checks that the backend kept each declared object.
When it didn't, `npx rayfin up` and `npx rayfin dev` against a Fabric backend fail with `connector-additional-payload-not-acknowledged` and name the connectors.
Those connectors were saved without the object, so they run without it until you deploy to a backend that supports it.
Remove `additionalPayload` from them to deploy without it.

## Declare it

```yaml
connectors:
  - name: sales
    type: eventhouse
    version: "1"
    auth:
      type: application
    config:
      workspaceId: "<workspace-guid>"
      itemId: "<kql-database-guid>"
    operations:
      - name: executeQuery
    additionalPayload:
      queries:
        salesSummary:
          operation: executeQuery
          text: |
            declare query_parameters(region:string);
            Sales | where Region == region
          parameters:
            region: string
```

The nested `queries` shape is only an illustration.
Check the connector's documentation for the keys it supports.

## How Rayfin handles it

- **JSON object only.**
  The value must be a YAML mapping.
  Nested mappings, lists, strings, booleans, `null`, and numbers are kept as written.
- **Kept verbatim.**
  `${VAR}` references inside `additionalPayload` are not interpolated, unlike the rest of `rayfin.yml`.
- **Absence is preserved.**
  A connector without the key is deployed without one, and `{}` is deployed as `{}`.
  Removing the key and running `npx rayfin up` removes the saved object.
- **Kept by updates that don't change connectors.**
  Updates that send back the saved settings, such as `npx rayfin up staticapp deploy` and the VS Code **Deploy Static Content** command, keep the saved object.
  The VS Code **Up: Deploy to Fabric** command doesn't send connectors, so it saves the settings without them, including their `additionalPayload`.
  Deploy projects that declare one with `npx rayfin up`.
- **Rejected values.**
  `npx rayfin up` and `npx rayfin dev` fail before writing settings when the value on a Category B connector is not a mapping, including an empty `additionalPayload:` line.
  They also fail when it contains a value JSON cannot represent exactly: `.inf`, `.nan`, integers beyond ±9007199254740991 (quote them as strings), `!!set`, `!!binary`, or a recursive alias.
  The error names the connector and the path of the value.
- **Size and nesting limits.**
  The object can be at most 65,536 bytes as compact JSON, and at most 32 levels of mappings and lists deep, counting the object itself.
  The CLI checks both before writing anything, and the error gives the limit and the actual value.
  The backend escapes non-ASCII characters and `<`, `>`, `&`, `'`, and `+` before it measures size, so an object close to the limit can pass the CLI check and still be rejected when you deploy.
- **Not in browser code.**
  It is never written to the generated `rayfin/connectors/<name>/schema.ts` or `src/lib/connectors.ts`.
- **Not sent by callers.**
  SDK and `npx rayfin connector invoke` requests carry only `{ "operation": "...", "input": { ... } }`.
  The deployed copy is used, so local edits take effect after `npx rayfin up`.

## Updating connectors

Re-running `npx rayfin connector add` for an existing Category B connector of the same type keeps its `additionalPayload`.
If the re-add changes the connector's `version`, the object is kept and the command warns: check that it is still valid for the new version.
If the re-add changes the connector type, the object is removed and the command warns, because it was written for the previous type.
Re-adding a Category A connector that still declares `additionalPayload` fails without changing any files; remove the key first.

## Security

`additionalPayload` is stored in plain text and is not a secret store.
It is saved in `rayfin.yml`, so in source control, and in the deployed app's storage.
`${VAR}` references in it are not interpolated, so it can't read a secret from the environment either.
Do not put secrets, such as connection strings or keys, in `additionalPayload`.
Use the connector's authentication settings for credentials.

Checks a connector performs with `additionalPayload`, such as allowing only saved queries, run in the connector runtime.
The SDK does not enforce them, so callers that use the API directly are subject to the same checks.

## Local development

`npx rayfin dev` against a Fabric backend saves `additionalPayload` to that backend, as `npx rayfin up` does.

The local Docker backend does not run connectors.
`npx rayfin dev` with the Docker provider doesn't send connectors to it, so a project that declares `additionalPayload` still runs locally, and the command warns that the object is not applied there.
Keep the key in `rayfin.yml`; it is applied by the next `npx rayfin up` or `npx rayfin dev` against Fabric.
A settings write sent directly to the local backend's API that declares `additionalPayload` is rejected with `CONNECTOR_ADDITIONAL_PAYLOAD_UNSUPPORTED` rather than saved without it.
