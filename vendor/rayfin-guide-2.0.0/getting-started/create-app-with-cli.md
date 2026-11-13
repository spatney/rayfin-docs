---
sidebar_position: 5
title: Create app with CLI
---

Project Rayfin is a modern **Backend-as-a-Service (BaaS)** platform that helps teams build and ship applications faster.
It provides ready-to-use backend infrastructure so you can focus on the product experience.

## Create an app from template

Use the Universal App starter.
Its CLI template ID is `blankapp`, displayed as **Use default template**.

First, check the available template IDs:

```bash
npx @microsoft/create-rayfin@latest --list-templates
```

Confirm that `blankapp` is listed, then create the app.
Replace `my-app` with your project name:

```bash
npx @microsoft/create-rayfin@latest --project-name my-app --template blankapp
```

Use the exact template ID, not a name inferred from its display label.
If `blankapp` is not listed, stop and report the documentation/CLI mismatch rather than guessing another template ID.

See [Project templates](../cli/templates.md) for more about template sources and discovery.

## Work with the generated app

Open the newly created project directory:

```bash
cd my-app
```

The Universal App starts with an authenticated welcome screen.

Follow the generated project's `README.md` for setup and run instructions.
For agent-assisted development, read the generated project's `AGENTS.md` before making changes.

The starting frontend view is in `packages/frontend/src/App.tsx`.
Frontend code, data definitions, and shared code live in separate workspace packages.

Use the generated project's capability guidance to add the features your app needs.
