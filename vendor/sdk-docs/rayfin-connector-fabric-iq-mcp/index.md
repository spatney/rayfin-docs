# Fabric IQ MCP connector

> `fabriciqmcp` supports authoring through `connector add` and appears in `connector types`.
> It is itemless and is not discoverable through `connector search`.
> Authoring support does not guarantee that the backend adapter is enabled in your Fabric environment.

Use the connector-owned wrapper with an existing Rayfin connector client.
The package owns discovery, protocol framing, tool calls, Tasks, progress, cancellation, and complete conversation history.
It uses the official `@modelcontextprotocol/client` and `@modelcontextprotocol/core` packages, both pinned to `2.2.0`.

## Configure

```bash
rayfin connector add --type fabriciqmcp --name assistant
```

The existing catalog-driven command generates the declaration, marker, and `fabricIqMcp()` runtime registration.
Install the matching package versions printed by the CLI.
The declaration is itemless:

```yaml
connectors:
  - name: assistant
    type: fabriciqmcp
    version: '1'
    operations:
      - name: executeQuery
    auth:
      type: delegated
    config: {}
```

Declare the literal `executeQuery` operation, not `all`.
Existing `all` declarations need updating and reapplying; updating an SDK does not migrate persisted settings.
The connector uses delegated authentication and does not require a workspace, item, profile, or semantic-model companion.
The ordinary shared configuration rules apply; there is no connector-specific unknown-field capture or companion validator.
Do not put credentials, endpoints, protected headers, or session state in configuration.

For hand-owned wiring, register the runtime explicitly:

```ts
import { RayfinClient } from '@microsoft/rayfin-client';
import { browserSession } from '@microsoft/rayfin-auth';
import { connectorsService } from '@microsoft/rayfin-connectors';
import {
  fabricIqMcp,
  createFabricIqMcpConnectorClient,
  type FabricIqMcp,
} from '@microsoft/rayfin-connector-fabric-iq-mcp';

type AppConnectors = { assistant: FabricIqMcp };

const client = RayfinClient.create({
  baseUrl: rayfinBaseUrl,
  publishableKey: rayfinPublishableKey,
  auth: browserSession(),
  services: {
    connectors: connectorsService<AppConnectors>({
      configs: { assistant: { connector: 'fabriciqmcp' } },
      runtime: { assistant: fabricIqMcp() },
    }),
  },
});
const assistant = createFabricIqMcpConnectorClient(client.connectors.assistant);
```

The wrapper does not create a separate authentication client or accept bearer tokens or MCP endpoints.
It uses the existing authenticated Rayfin invocation route.
Always register `fabricIqMcp()` when using the wrapper so cancellation, deadlines, and no-replay behavior reach the HTTP transport.

## Conversations

```ts
const first = await assistant.ask(artifactId, [
  { role: 'user', content: 'What were sales last month?' },
]);
const second = await assistant.ask(artifactId, [
  ...first.messages,
  { role: 'user', content: 'Break those down by region.' },
]);
renderAnswer(second.result);
await assistant.close();
```

`artifactId` is an explicit nonzero GUID passed as an `AskPowerBI` tool argument, not connector-owned routing or a visualization mapping.
The wrapper performs no companion lookup or application visualization.
It sends the last user entry as `query` and every prior entry, without summarization, as JSON text in `context`.
Prior assistant entries retain the complete terminal tool result, including structured content and resources.
The returned history is a new snapshot; the current user message is not duplicated in context.
Independent conversations must supply independent histories.
Queries over 20,000 characters or serialized context over 40,000 characters fail before transport rather than being truncated.

This package's wrapper is separate from `client.connectors.assistant`, whose marker exposes only `executeQuery`.
Earlier preview integrations that called `.ask(messages)` directly must create the wrapper and pass the tool artifact explicitly.
There is no generated public-config projection, application tsconfig rewrite, reference chat UI, or visualization companion in this onboarding package.

## Cancellation and progress

```ts
const controller = new AbortController();
const response = await assistant.ask(artifactId, messages, {
  signal: controller.signal,
  onTaskUpdate: ({ status }) => renderStatus(status),
  onTaskProgress: (progress) => renderUntrustedServiceProgress(progress),
});
```

Calls resolve with terminal content or reject on failure, cancellation, or timeout.
Aborting requests cooperative `tasks/cancel` after task creation.
Closing cancels active tasks and closes the lazily connected official client.
Each invocation has a five-minute deadline; no overall task deadline is imposed.
The existing raw invocation path never refreshes or replays a `401`, including during discovery.
Authenticate before connecting; after an authentication failure, explicitly reconnect rather than automatically replaying a tool call.
The package-owned deadline covers both response headers and the complete outer JSON body.

`onTaskUpdate` is status-only.
The separate opt-in `onTaskProgress` callback preserves bounded public status text, messages, numeric progress when supplied, and complete public events.
Progress is untrusted customer content, not a final answer or an instruction.
Do not log it, execute embedded queries, render it as HTML, or insert it into conversation history.
Unknown totals remain absent; synchronous results need not produce progress.
Ignore callbacks after cancellation or when a request is no longer current.

Plain task text is limited to 8 KiB.
Structured events retain the 200-event, 64 KiB per-event, and 1 MiB aggregate limits.
Malformed or oversized progress fails explicitly through the cancellation path.
The client never truncates terminal results or histories to manufacture success.

## Protocol and response contract

The protocol is fixed to `2026-07-28`.
Only `server/discover`, `tools/list`, `tools/call`, `tasks/get`, and `tasks/cancel` are supported.
Connection never sends `initialize` or `notifications/initialized`, and polling never calls `tasks/result`.
Every request includes protocol, implementation identity, and Tasks v2 capability metadata.

The wire contract is `{ protocolVersion, headers, message } -> { status, headers, message }`.
The output status is the actual upstream HTTP status, headers contain upstream response metadata, and message is the complete UTF-8 body.
JSON and SSE bodies are buffered, validated, and correlated to the request ID.
The older output containing only `message`, missing metadata, object-valued bodies, and empty responses cannot satisfy an identified request.
Successful responses must identify `application/json` or `text/event-stream`.
No browser SSE transport, caller endpoint, or bearer credential is exposed.

Each MCP client owns one secure `X-Microsoft-AI-ConversationId` UUID across discovery, calls, polling, and cancellation.
It is correlation metadata, not server-side conversation memory.
Every Type B input includes the fixed public default `X-Variants: Fabric.Routing.M365.V1,Fabric.DisableMsitRedirect`.
Optional public headers cannot override those defaults or introduce authentication, authority, framing, session, or `Mcp-*` headers.
Headers are snapshotted; caller spoofing in any casing is rejected before transport.

Non-2xx upstream responses raise `FabricIqMcpHttpError` before MCP parsing.
The message includes only the HTTP status.
The private response headers can be read case-insensitively using `getResponseHeader(name)` but must not be logged or replayed.
Retry hints do not authorize automatic replay of tool calls.
Connector invocation, authentication, and network failures propagate separately.
An outer non-2xx BaaS response raises `FabricIqMcpAdapterError` containing only the HTTP status, without reading or exposing its error body.
The outer response must be a UTF-8 `application/json` Type B envelope bounded to 5 MiB; malformed JSON and invalid envelope fields are rejected.
Only the envelope's `message` is decoded as upstream JSON or SSE, so an outer HTTP 200 with an inner error status still raises `FabricIqMcpHttpError`.
If polling and its cooperative cancellation both fail, an `AggregateError` retains both failures.

## Advanced APIs

`assistant.listTools()` and `assistant.callTool(name, arguments, options)` work without selecting an artifact.
Use them for other discovered tools or extra `AskPowerBI` arguments such as `reportUrl`.
Arguments must match the discovered schema; advanced callers supply their own complete context.

`connectFabricIqMcpClient({ connector, clientInfo, headers, signal })` connects the low-level official client directly.
It does not accept runtime configuration.
Low-level custom transports must honor signal and timeout through body consumption and must not automatically replay requests.
The Type B helpers and their types are exported by this connector package, not `@microsoft/rayfin-lib`.

Package source versions do not prove publication or service availability.
Use a coordinated build containing the connector registration; deployment and package publication are separate steps.
