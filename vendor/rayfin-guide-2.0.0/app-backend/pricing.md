---
sidebar_position: 2
title: Pricing and capacity usage
---

Fabric data apps run on Microsoft Fabric capacity.
There are **no additional Rayfin-specific charges** — you pay only for the Fabric capacity units (CUs) consumed by the underlying services your application uses.

## How billing works

Fabric uses a universal billing model based on **Capacity Units (CUs)**.
Every operation performed by a Fabric data app child service consumes CUs from the Fabric capacity assigned to your workspace.

Your workspace must have a Fabric capacity associated with it.
CU consumption is tracked in the [Microsoft Fabric Capacity Metrics app](https://learn.microsoft.com/fabric/enterprise/metrics-app) where you can monitor usage per item and per operation.

## What consumes capacity

A Fabric data app uses three Fabric services that consume CUs:

### SQL Database

The SQL Database child item consumes CUs for compute and storage.

| Operation | What it covers | Billing meter | Type |
| --- | --- | --- | --- |
| **SQL Usage** | Compute for all SQL queries, modifications, and data processing — includes queries from your application's GraphQL API and any queries you run in the Fabric portal query editor. | SQL database in Microsoft Fabric Capacity Usage CU | Interactive |
| **Allocated SQL Storage** | Dynamically allocated storage for tables, indexes, transaction logs, and metadata. Fully integrated with OneLake. | SQL Storage Data Stored | Background |

One Fabric CU equals 0.383 SQL database vCores.

### GraphQL API

Every GraphQL query (read) and mutation (write) made by your application's `RayfinClient` consumes CUs.
The consumption rate is ten CUs per hour of request and response processing time.

| Operation | What it covers | Billing meter | Type |
| --- | --- | --- | --- |
| **Query** | Compute for all GraphQL queries (reads) and mutations (writes) performed by API clients against your data models. | API for GraphQL Query Capacity Usage CU | Interactive |

For more details, see [Fabric API for GraphQL](https://learn.microsoft.com/en-us/fabric/enterprise/fabric-operations#fabric-api-for-graphql) in the Fabric operations documentation.

### OneLake storage (static content)

When static hosting is enabled, your built frontend assets (HTML, CSS, JS) are stored in OneLake and served from a public URL.
OneLake storage and the read/write operations to serve content consume CUs.

| Operation | What it covers | Billing meter | Type |
| --- | --- | --- | --- |
| **OneLake Read** | Read operations when serving static content to end users. | OneLake Read Operations Capacity Usage CU | Background |
| **OneLake Write** | Write operations when deploying or updating static content via `rayfin up`. | OneLake Write Operations Capacity Usage CU | Background |
| **OneLake Storage** | Storage of static content files in OneLake. | OneLake Storage | Background |

## What does not consume additional capacity

The following Fabric data app capabilities do **not** incur separate CU charges at this time:

- **Rayfin WebService** — The application backend service that handles API routing and authentication.
- **Authentication** — Fabric brokered auth (Entra SSO) sign-in and session management.
- **Deployment operations** — Running `rayfin up` to deploy your application does not have its own CU charge beyond the SQL and OneLake operations it triggers.

## Further reading

- [Fabric operations](https://learn.microsoft.com/en-us/fabric/enterprise/fabric-operations) — Full list of Fabric operations and their capacity consumption rates.
- [Microsoft Fabric Capacity Metrics app](https://learn.microsoft.com/en-us/fabric/enterprise/metrics-app) — Monitor and understand your capacity usage.
- [Fabric Data App in Fabric](./index.md) — Overview of the Fabric data app and its child services.
