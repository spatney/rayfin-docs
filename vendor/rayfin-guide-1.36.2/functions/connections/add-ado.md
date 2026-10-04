---
sidebar_position: 5
---

# Add Azure DevOps

Call the [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/) from a deployed function using `AudienceType.ADO`.

Grant the [application identity](../index.md#application-authentication) access to your Azure DevOps organization and the permissions required by the project or resource you call.

Provide your Azure DevOps **organization** (and project, if the call needs one) — e.g. `https://dev.azure.com/<org>`. The token is a standard bearer token — send it with `fetch`:

`AppSchema` below is your app's data schema — the same type you pass to `RayfinClient<AppSchema>`. See [Writing functions](../writing-functions.md#accessing-data-and-request-context).

```ts
import {
  UserDataFunctions,
  AudienceType,
  type RayfinContext,
} from "@microsoft/fabric-user-data-functions";

const udf = new UserDataFunctions();

// Use your real organization URL.
const ORG = "https://dev.azure.com/<org>";

udf.func(
  "listProjects",
  async (ctx: RayfinContext<AppSchema, AudienceType.ADO>): Promise<unknown> => {
    const token = ctx.Tokens.ADO;
    const res = await fetch(`${ORG}/_apis/projects?api-version=7.1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Azure DevOps returned ${res.status}`);
    }
    return res.json();
  },
  [],
);
```

See [Connecting to external resources](./index.md) for the shared connection model.
