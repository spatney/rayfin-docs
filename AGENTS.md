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
- Optional: `tags: []`, `appliesTo: "@microsoft/rayfin-cli >= 1.36"`. `appliesTo` is
  emitted as `applies_to` in the `.md` mirror's frontmatter; set it on any page that only
  works with packages newer than 1.35.

## Version tags

The site documents the release pinned in `lib/site.config.ts`. Untagged content works on
Rayfin 1.35.0 and later. Anything added or changed after 1.35.0 carries an inline tag: a
plain Markdown link into the changelog that the renderer upgrades to a pill
(`components/version-badge.tsx`). In the `.md` mirror it stays a readable link an agent can
follow. What 1.35 changed relative to 1.34 lives only on the changelog page.

| Tag | Use for |
| --- | --- |
| `[New in 1.36](/docs/reference/changelog#rayfin-136)` | A page, command, flag, option, or API that did not exist before that release |
| `[Changed in 1.36](/docs/reference/changelog#rayfin-136)` | Existing behavior, a default, or a name that changed in that release |
| `[Deprecated in 1.36](/docs/reference/changelog#rayfin-136)` | Still works, but has a replacement |
| `[Removed in 1.36](/docs/reference/changelog#rayfin-136)` | No longer works from that release |
| `[Preview](/docs/reference/changelog#feature-status)` | Shipped, but its shape may still change |
| `[Experimental](/docs/reference/changelog#feature-status)` | Behind a feature flag or rollout |

- Tag at the smallest accurate scope: the end of a table cell for one flag or option, its
  own line directly under the heading for a section, the first line of the body for a page.
- Never put a tag inside a heading — it changes the anchor and leaks into the TOC.
- Use minor versions (`1.36`). Name a patch (`1.36.2`, `1.35.1`) only when that patch
  shipped the feature or changed the behavior.
- Every tag needs a matching entry on `/docs/reference/changelog`. `check:docs` rejects a
  tag whose label and anchor disagree, and any version tag at or below 1.35.0.
- All `@microsoft/rayfin-*` packages, including the CLI, share one version number, so a
  tag means "this release of every Rayfin package".
- Untagged content applies to every release the site covers (1.35.0 and later). Do not
  tag content that shipped in 1.35.0 or earlier.

## Writing style

- **Task-first.** Open with what the reader is trying to do, not with a definition.
- **One idea per heading.** Agents chunk on headings; a heading that covers three topics
  retrieves badly.
- **Show the whole file.** Prefer a complete, runnable snippet over a fragment with
  `// ...`. Agents copy what they see.
- **Always label fences** with a language. Add `title="rayfin/data/Todo.ts"` when the
  snippet belongs in a specific file — agents use it to decide where to write.
- **Be explicit about where code runs.** Rayfin runs one way: as a managed Fabric app, so
  the backend is always deployed. During development, `rayfin dev` keeps that backend in
  Fabric and runs only your frontend — plus Functions, when enabled — on `localhost`.
  Fabric SSO's popup flow works from any origin listed in `allowedRedirectUris` —
  including a local Vite dev server at `http://localhost:5173`; only the embedded (iframe)
  flow requires the app itself to be loaded inside the Fabric portal. Say which flow you
  mean.
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
Fabric. The managed backend — data, auth, storage — always runs in Fabric.

The development loop is in scope and must be kept. Every bundled template's `npm run dev`
script runs `rayfin dev`, which provisions or reuses the Fabric backend, applies declared
state and schema, then starts the frontend (Vite) — and Functions, when enabled — as local
processes. Keep `http://localhost:5173` in `allowedRedirectUris` examples.
`rayfin up --exclude-services staticHosting` still exists for scripts that deploy the
backend while a dev server serves the frontend; prefer `rayfin dev` in prose.

Do not document these — they are experimental or unsupported and will be added back
deliberately later:

- The Docker provider: `rayfin dev --provider docker`, its maintenance flags (`--stop`,
  `--down`, `--purge`, `--export-env`) and its subcommands (`rayfin dev db apply`,
  `rayfin dev status`, `rayfin dev watch`)
- Docker, Docker Compose, local database containers, Azurite, MailDev
- The `docker-local-dev` feature flag, or "Rayfin Local" / self-hosted as a backend mode
- A managed backend (data, auth, storage) running on `localhost`, or its ports
- PostgreSQL as a dialect — Fabric supports `mssql` only
- Email/password auth and magic links. **Microsoft Entra ID is the only supported identity
  provider**: Fabric SSO for browser apps, plus direct Entra token sign-in and the external
  embed host for code that already holds a delegated Entra token.

## Feature status

| Feature | Status | How to present it |
| --- | --- | --- |
| Functions | GA since 1.36 (no feature flag) | Not available in every Fabric region or tenant — keep that `> [!NOTE]` on Functions pages, but do not call Functions experimental |
| Connectors | GA since 1.36 (no feature flag) | `rayfin up connector apply` is `[Preview]`. Kusto (Eventhouse) is held back: existing connectors keep working, new ones cannot be added |
| Storage | Experimental — `RAYFIN_FEATURE_FLAGS=storage` or `services.storage.enabled` | `> [!WARNING]` callout plus the `[Experimental]` tag, and the same region/tenant caveat |
| Function connections | Application identity only since 1.36 (`services.functions.auth.type: application` is required) | Deployed Functions reach external resources as the app identity — never describe them as acting as the signed-in user. Rayfin data access from a function stays caller-scoped |

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

- `vendor/rayfin-guide-1.36.2/` — the upstream guide snapshot.
- `vendor/sdk-docs/` — per-package docs shipped in each package's `assets/docs`.
- `vendor/SKILL.md` and `vendor/cli-assets/agent-files/skills/` — the agent skills
  installed by `rayfin init ai-files`.
- The published npm packages themselves (`npm pack @microsoft/rayfin-<name>@<version>`),
  and `rayfin <command> --help` from the pinned CLI version.

The Rayfin source monorepo is useful for depth, but its `main` branch runs ahead of what
is published. Read it at the release tag (`git show npm/v1.36.2:<path>`), never from a
working tree. If a behaviour cannot be verified from those sources or from the installed
packages, do not document it. Leave it out rather than guessing. Behaviour behind an
internal rollout flag (for example `cli-minor-fixes`) is not shipped behaviour.

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
