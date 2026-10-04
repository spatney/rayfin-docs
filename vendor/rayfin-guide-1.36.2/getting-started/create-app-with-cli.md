---
sidebar_position: 5
title: Create app with CLI
---



Project Rayfin is a modern **Backend-as-a-Service (BaaS)** platform that helps teams build and ship applications faster.
It provides ready-to-use backend infrastructure so you can focus on the product experience.

## Create an app from template

Run `npm create @microsoft/rayfin@latest` in a terminal window and select welcome template for Typescript.

## Run the app

1. Sign in to Fabric with `npx rayfin login`.
In an environment without OS credential storage, use `npx rayfin login --encryption-fallback-enabled` only if you accept plaintext token caching for development.
2. In the same terminal window, run `npm run dev`.
The command provisions or reuses the Fabric backend, applies declared state, and starts the frontend locally.
3. When the frontend starts, it will output the page to visit.
Visit and ensure you can view the Timestamp Tracker.
4. Click **Send Timestamp** to POST the current time to `/api/graphql/Timestamp`, then use **Refresh list** to pull back the newest 100 entries.
5. All UI plus data-fetching logic lives in a single file: `src/main.ts`.
6. To target a specific Fabric workspace, set `RAYFIN_WORKSPACE_ID` and re-run `npm run dev`.

## Update the data model

Add a `message` field to the **Timestamp** entity in `rayfin/data/Timestamp.ts`.

```typescript
import { entity, anonymous, uuid, text, date } from '@microsoft/rayfin-core';

@entity()
@anonymous()
export class Timestamp {
  @uuid() id!: string;
  @date() timestamp!: Date;
  @text() message!: string;
}
```

## Update the frontend to display the message

In `src/main.ts`, update the creation and query to include the `message` field, add a table header, and display the message in the table rows.

```typescript
// 1. Update sendTimestamp to include message
await this.rayfinClient.data.gql.Timestamp.create({
  timestamp: now,
  message: 'Hello from Rayfin!',  // Add this
});

// 2. Update the query to include 'message'
const items = await this.rayfinClient.data.gql.Timestamp.select([
  'id',
  'timestamp',
  'message',  // Add this
]);

// 3. Update the row template in the updateTable function
const rows = this.timestamps
  .map(
    (entry) => `
    <tr>
      <td class="timestamp-mono">${entry.id}</td>
      <td>${formatDate(entry.timestamp)}</td>
      <td>${entry.message}</td>
    </tr>
  `
  );

// 4. Update the table headers in the updateTable function
<thead>
  <tr>
    <th>ID</th>
    <th>Timestamp</th>
    <th>Message</th>
  </tr>
</thead>
```

## Apply database changes

After updating your data models, apply the changes to your database.

```bash
npx rayfin up db apply
```

## Test your changes

After updating your data models, test your app.

```bash
npm run dev
```

> NOTE: Restart `npm run dev` after changing `rayfin.yml` so the backend receives the updated declared state.

## View your local database

1. Identify your container name or ID for the database service.
Use this command to list all running containers and note the name or ID of your database container.

```bash
docker ps
```

1. Access the container's shell and use the container name or ID for the database.

```bash
docker exec -it <container_name_or_id> bash
```

1. Once inside the container's shell, use the appropriate command for your database system.

```bash
psql -U RayfinDB
```
