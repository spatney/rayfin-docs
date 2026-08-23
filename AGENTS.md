# Contributing to the Rayfin docs

This repository is the official Rayfin documentation site. It is **agent-first**: every
page must be as useful to a coding agent reading raw Markdown as it is to a human reading
the rendered site.

## The one rule that governs everything

> Every page must read identically as HTML and as Markdown.

Appending `.md` to any route returns that page as raw Markdown (`/docs/data/querying` →
`/docs/data/querying.md`). That mirror is generated from the same MDX, so **anything that
only exists as a React component disappears for agents**. Express rich content through
Markdown primitives that the renderer upgrades, not through MDX components.

| Need | Author as | Renders as | In `.md` |
| --- | --- | --- | --- |
| Copy-pasteable prompt | ` ```prompt title="…" ` fence | Prompt card with Copy / Copilot app | intact fence |
| Note, warning, tip | GFM alert `> [!NOTE]` | Callout | intact alert |
| Diagram | ` ```mermaid ` fence | Diagram | intact fence |
| Code sample | fenced block with a language + `title=` | Shiki block with copy button | intact fence |
| Comparison | GFM table | table | table |

Allowed MDX components: `<Tabs>`, `<Cards>` / `<Card>`, `<Steps>` / `<Step>`. Nothing else
without also teaching `scripts/check-docs.mts` about it. Keep them shallow — content
inside a component must still make sense when flattened into Markdown.

## Frontmatter contract

Every page needs `title` and `description`. Both are enforced by `npm run check:docs`.

```yaml
---
title: Querying data
description: Read records with the type-safe GraphQL client — filters, ordering, pagination, and relationship traversal.
---
```

- `description` is one sentence, ≤ 200 characters, and must make sense **out of context**.
  It is what an agent sees in `/llms.txt` when deciding whether to open the page.
- Optional: `tags: []`, `appliesTo: "@microsoft/rayfin-core >= 1.34"`.

## Writing style

- **Task-first.** Open with what the reader is trying to do, not with a definition.
- **One idea per heading.** Agents chunk on headings; a heading that covers three topics
  retrieves badly.
- **Show the whole file.** Prefer a complete, runnable snippet over a fragment with
  `// ...`. Agents copy what they see.
- **Always label fences** with a language. Add `title="rayfin/data/Todo.ts"` when the
  snippet belongs in a specific file — agents use it to decide where to write.
- **Be explicit about where code runs.** Rayfin runs one way: as a managed Fabric app, so
  the backend is always deployed. Fabric SSO's popup flow works from any origin listed in
  `allowedRedirectUris` — including a local Vite dev server at `http://localhost:5173`;
  only the embedded (iframe) flow requires the app itself to be loaded inside the Fabric
  portal. Say which flow you mean.
- **Link with absolute site paths**: `/docs/data/permissions`. Never relative `./x.md`.
- **No marketing.** No "simply", "just", "easy", "powerful".

## Prompts

Add a prompt to any page describing a task a reader would plausibly delegate. Prompts are
self-contained — an agent receiving one with no other context must be able to act on it.

````md
```prompt title="Add per-user row-level security"
In my Rayfin project, add row-level security to the Todo entity in rayfin/data/Todo.ts so
each signed-in user can only read and write their own rows. Use the @role decorator with a
policy comparing claims.sub to the user_id field. Then apply the schema with `rayfin up`.
```
````

Do not write "ask your agent to do X" as prose. Write the prompt.

## Product scope

Rayfin currently documents **one** way to run: as a managed **Fabric app** on Microsoft
Fabric. Do not document these — they are experimental or unsupported and will be added
back deliberately later:

- `rayfin dev`, Docker, Docker Compose, local database containers, Azurite, MailDev
- The `docker-local-dev` feature flag, or "Rayfin Local" / self-hosted as a backend mode
- A backend running on `localhost`, or local backend ports
- PostgreSQL as a dialect — Fabric supports `mssql` only
- Email/password auth and magic links. **Fabric SSO (Entra ID) is the only supported
  authentication method.**

What *is* in scope, and must be kept: running your **frontend** locally with `npm run dev`
(Vite) against a deployed Fabric backend. That is the normal development loop —
`rayfin up --exclude-services staticHosting` deploys the backend while Vite serves the
frontend from `localhost`. Keep `http://localhost:5173` in `allowedRedirectUris` examples.

## Naming

- **Rayfin** is the product. Use it as the primary name.
- **Fabric app** (or "managed Fabric app") is the deployed, Microsoft Fabric–hosted mode.
  Use this in prose.
- In the Fabric portal, the item you create from **New item** is called **App (preview)**.
  Use that exact label whenever you are describing something the reader clicks, so the docs
  match what is on screen.
- **Fabric data app** is a specific *template* name, not the item type. Do not use it as a
  general term for the deployed app, and do not use it in New item instructions.
- Never write "Project Rayfin" — it is not an official term.

## Accuracy

Content is grounded in shipped code, not invented. Source material:

- `vendor/rayfin-guide-1.34.0/` — the upstream guide snapshot.
- `vendor/sdk-docs/` — per-package API docs.
- `vendor/SKILL.md` — the agent skill shipped by `rayfin init ai-files`.

If a behaviour cannot be verified from those sources or from the installed packages, do
not document it. Leave it out rather than guessing.

## Commands

```bash
npm run dev          # local dev server
npm run build        # static export to out/ + agent assets
npm run check:docs   # frontmatter, links, fences, component allowlist
npm run verify:agent # every route has a valid .md mirror
npm run typecheck
```

## Architecture notes

- `output: 'export'` means `rewrites()` does not run. The `.md` mirrors are emitted by the
  `/llms.mdx/docs/[...slug]` route handler and remapped to their final paths by
  `scripts/emit-agent-assets.mts`.
- Every mirror route ends in a literal `_md` segment so that a section index and its
  children never need the same path to be both a file and a directory.
- `prompt` is registered as a real (empty) Shiki grammar in `source.config.ts` so that
  `addLanguageClass` emits `language-prompt` for the renderer to detect.
