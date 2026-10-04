---
sidebar_position: 4
---

# Add Azure AI Foundry

Call an **Azure AI Foundry** (Azure OpenAI / Azure AI) resource from a deployed function using `AudienceType.AzureAI`.

Grant the [application identity](../index.md#application-authentication) the permissions required by your Azure AI resource and API.

Provide the resource **endpoint** (Azure AI Foundry → your resource → _Endpoint_). The token is a standard bearer token — send it with `fetch`, or wrap it with the [`ContextTokenCredential`](./index.md#wrapping-the-token-for-azure-sdk-clients) helper for an Azure AI SDK client.

`AppSchema` below is your app's data schema — the same type you pass to `RayfinClient<AppSchema>`. See [Writing functions](../writing-functions.md#accessing-data-and-request-context).

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

// Use your resource's real endpoint.
const AI_ENDPOINT = "https://<resource>.services.ai.azure.com";

udf.func(
  "callAzureAi",
  async (
    ctx: RayfinContext<AppSchema, AudienceType.AzureAI>,
    prompt: string,
  ): Promise<unknown> => {
    const token = ctx.Tokens.AzureAI;
    const res = await fetch(`${AI_ENDPOINT}/...`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      throw new Error(`Azure AI returned ${res.status}`);
    }
    return res.json();
  },
  [],
);
```

Fill in the request path and body from the specific Azure AI API you are calling.

See [Connecting to external resources](./index.md) for the shared connection model.
