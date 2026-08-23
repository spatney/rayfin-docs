# Rayfin docs

The official documentation site for [Rayfin](https://rayfin.ai) — Microsoft's TypeScript
backend-as-a-service, managed on Microsoft Fabric.

It is built to be read by coding agents as well as by people. Every page has a raw
Markdown mirror, the whole corpus is available as a single file, and pages carry
copy-pasteable prompts instead of only prose instructions.

## Agent surface

| Route | What it is |
| --- | --- |
| `<any-docs-route>.md` | That page as raw Markdown with YAML frontmatter |
| `/llms.txt` | Index of every page with descriptions |
| `/llms-full.txt` | The entire documentation set in one file |
| `/AGENTS.md` | Operating brief for agents, at the site root |
| `/sitemap.xml` | Every HTML page and every Markdown mirror |

```bash
curl https://rayfin.ai/docs/data/querying.md
```

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
```

## Build

```bash
npm run build          # static export to out/, plus the agent assets
npm run verify:agent   # assert every route has a valid .md mirror
npm run check:docs     # content lint
npm run typecheck
```

The build is a fully static export with no server runtime, so `out/` can be served from
Azure Static Web Apps, GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static host.
Header and MIME configuration for each of those is emitted into `out/` automatically so
`.md` is served as `text/markdown` rather than downloaded.

Set `NEXT_PUBLIC_SITE_URL` at build time to control the canonical origin used in
frontmatter, `llms.txt`, and the sitemap.

## Deployment

The site is deployed to **Azure Static Web Apps** at [rayfin.ai](https://rayfin.ai).

| | |
| --- | --- |
| Resource group | `rayfin-docs` |
| Static Web App | `rayfin-docs` (Free tier, East US 2) |
| DNS zone | `rayfin.ai` (apex `ALIAS` → the Static Web App, `www` `CNAME`) |
| Workflow | `.github/workflows/deploy.yml` |

Every push to `master` runs lint → build → typecheck → verify → deploy. Pull requests get
their own preview environment, torn down when the PR closes.

Two configuration values live in the repository:

- `AZURE_STATIC_WEB_APPS_API_TOKEN` (secret) — the deployment token.
- `SITE_URL` (variable) — the canonical origin baked into `.md` frontmatter, `llms.txt`,
  and `sitemap.xml`. Change this to move the site to a different domain.

> The site is prebuilt in the workflow with `skip_app_build: true`. Oryx must not build it,
> because the agent surface is produced by a post-build step it would not run.

### Notes on Static Web Apps

Static Web Apps does not map an extensionless request to `<path>.html` — it only serves a
directory's `index.html`. `scripts/emit-agent-assets.mts` therefore mirrors every
`foo.html` to `foo/index.html`, which keeps clean URLs working without switching the export
to `trailingSlash: true`.

MIME types for `.md` and `.txt`, CORS headers, and the 404 override are emitted into
`out/staticwebapp.config.json` at build time.

## Layout

```text
app/                       Next.js App Router
  docs/[[...slug]]/        rendered docs pages
  llms.txt/                /llms.txt route handler
  llms-full.txt/           /llms-full.txt route handler
  llms.mdx/docs/[...slug]/ raw markdown mirrors (remapped at build time)
  api/search/              static search index
content/docs/              the documentation itself — source of truth
components/                PromptCard, PageActions, MDX wiring
lib/                       source loader, site config, markdown generation
scripts/                   emit-agent-assets, verify-agent-assets, check-docs
vendor/                    frozen upstream snapshots, reference only
```

## How the `.md` mirrors work

`output: 'export'` disables Next.js `rewrites()`, so the usual "rewrite `/docs/x.md` to a
handler" approach is unavailable. Instead the `/llms.mdx/docs/[...slug]` route handler is
statically exported, and `scripts/emit-agent-assets.mts` remaps its output to the final
`.md` paths. The result is plain static files that work on any host with no runtime.

Every mirror route ends in a literal `_md` segment so that a section index (`/docs/data`)
and its children (`/docs/data/querying`) never need the same path to be both a file and a
directory.

## Contributing

Read [AGENTS.md](./AGENTS.md) — it is the authoring contract. The rule that governs
everything: **a page must read identically as HTML and as Markdown**, so rich content is
expressed through Markdown primitives that the renderer upgrades, never through MDX
components that vanish for agents.

## License

MIT
