/**
 * Post-build step: turn Next's static export into an agent-consumable site.
 *
 * `output: 'export'` disables `rewrites()`, so the `<route>.md` convention cannot be
 * served by a rewrite. Instead the `/llms.mdx/docs/**` route handler is statically
 * exported by Next, and this script remaps those files to their `.md` locations.
 * The result is a plain static tree that works on any host with no runtime.
 *
 *   out/llms.mdx/docs                     ->  out/docs.md
 *   out/llms.mdx/docs/data/querying       ->  out/docs/data/querying.md
 *
 * It also emits the discovery surface: AGENTS.md, sitemap.xml, robots.txt, and
 * per-host MIME configuration so `.md` is served as text/markdown.
 */
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const MIRROR_ROOT = path.join(OUT, 'llms.mdx', 'docs');

/** Must match TERMINAL in app/llms.mdx/docs/[...slug]/route.ts. */
const TERMINAL = '_md';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rayfin.ai').replace(
  /\/$/,
  '',
);

type Emitted = { route: string; mdPath: string; title: string; description: string };

async function main() {
  if (!existsSync(OUT)) {
    throw new Error(`No out/ directory at ${OUT}. Run \`next build\` first.`);
  }
  if (!existsSync(MIRROR_ROOT)) {
    throw new Error(
      `No markdown mirrors at ${MIRROR_ROOT}. The /llms.mdx/docs route handler did not emit.`,
    );
  }

  const emitted = await emitMarkdownMirrors();
  emitted.sort((a, b) => a.route.localeCompare(b.route));

  // The mirror tree is an implementation detail; only the .md files ship.
  await rm(path.join(OUT, 'llms.mdx'), { recursive: true, force: true });

  const indexCopies = await emitDirectoryIndexes();

  await writeAgentsFile(emitted);
  await writeSitemap(emitted);
  await writeRobots();
  await writeHostConfigs();
  await writeFile(path.join(OUT, '.nojekyll'), '');

  console.log(`[agent-assets] ${emitted.length} markdown mirrors emitted`);
  console.log(`[agent-assets] ${indexCopies} directory index copies for extensionless routes`);
  console.log('[agent-assets] wrote AGENTS.md, sitemap.xml, robots.txt, host configs');
}

/**
 * Mirror `foo.html` to `foo/index.html`.
 *
 * Azure Static Web Apps does not map an extensionless request to `<path>.html`; it only
 * serves a directory's `index.html`. Emitting both shapes keeps clean, trailing-slash-free
 * URLs working there without switching the whole export to `trailingSlash: true`, which
 * would change where every other artifact lands.
 */
async function emitDirectoryIndexes(): Promise<number> {
  let count = 0;

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '_next') continue;
        await walk(full);
        continue;
      }

      if (!entry.name.endsWith('.html') || entry.name === 'index.html') continue;

      const target = path.join(dir, entry.name.replace(/\.html$/, ''), 'index.html');
      if (existsSync(target)) continue;

      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await readFile(full, 'utf8'), 'utf8');
      count++;
    }
  }

  await walk(OUT);
  return count;
}

/** Recursively walk the mirror tree, writing each entry to its `.md` location. */
async function emitMarkdownMirrors(): Promise<Emitted[]> {
  const emitted: Emitted[] = [];

  // Every mirror is a leaf file named `_md`; its parent directories are the docs
  // route. See app/llms.mdx/docs/[...slug]/route.ts for why.
  async function walk(dir: string, segments: string[]) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, [...segments, entry.name]);
      } else if (entry.isFile() && entry.name === TERMINAL) {
        emitted.push(await copyMirror(full, ['docs', ...segments]));
      }
    }
  }

  await walk(MIRROR_ROOT, []);
  return emitted;
}

async function copyMirror(source: string, segments: string[]): Promise<Emitted> {
  const body = await readFile(source, 'utf8');
  const route = `/${segments.join('/')}`;
  const target = path.join(OUT, ...segments) + '.md';

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, 'utf8');

  return {
    route,
    mdPath: `${route}.md`,
    title: frontmatterValue(body, 'title') || route,
    description: frontmatterValue(body, 'description'),
  };
}

function frontmatterValue(body: string, key: string): string {
  const match = body.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  const raw = match[1].trim();
  try {
    return raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
  } catch {
    return raw;
  }
}

async function writeAgentsFile(pages: Emitted[]) {
  const content = `# Rayfin — instructions for coding agents

You are reading the machine-readable entry point for the official Rayfin documentation.
Rayfin is a TypeScript backend-as-a-service: you define entities as decorated TypeScript
classes and Rayfin generates the database schema, REST and GraphQL APIs, type-safe
clients, auth, and static hosting. It runs locally on Docker or as a managed Fabric app
on Microsoft Fabric.

## How to read these docs

- **Every** documentation route has a raw Markdown mirror: append \`.md\` to the URL.
  \`${SITE_URL}/docs/data/querying\` -> \`${SITE_URL}/docs/data/querying.md\`
- [\`/llms.txt\`](${SITE_URL}/llms.txt) — index of every page with descriptions.
- [\`/llms-full.txt\`](${SITE_URL}/llms-full.txt) — the entire documentation set in one file.
- [\`/docs/ai/rules\`](${SITE_URL}/docs/ai/rules) — the condensed do/don't list. **Read this before generating Rayfin code.**

## Before you write any Rayfin code

Read [\`${SITE_URL}/docs/ai/rules.md\`](${SITE_URL}/docs/ai/rules.md) and
[\`${SITE_URL}/docs/reference/known-limitations.md\`](${SITE_URL}/docs/reference/known-limitations.md).
Rayfin has platform constraints (text length caps on MSSQL, no many-to-many, foreign key
naming rules) that silently break deployments if ignored.

## All pages

${pages.map((p) => `- [${p.title}](${SITE_URL}${p.mdPath})${p.description ? `: ${p.description}` : ''}`).join('\n')}
`;

  await writeFile(path.join(OUT, 'AGENTS.md'), content, 'utf8');
}

async function writeSitemap(pages: Emitted[]) {
  const urls = [
    '/',
    ...pages.map((p) => p.route),
    // Markdown mirrors are listed too so agent crawlers discover them directly.
    ...pages.map((p) => p.mdPath),
    '/llms.txt',
    '/llms-full.txt',
    '/AGENTS.md',
  ];

  const body = urls
    .map((u) => `  <url>\n    <loc>${SITE_URL}${u === '/' ? '' : u}/</loc>\n  </url>`)
    .join('\n')
    // Trailing slashes are wrong for file-like URLs.
    .replace(/(\.md|\.txt)\/</g, '$1<');

  await writeFile(
    path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
    'utf8',
  );
}

async function writeRobots() {
  const content = `# Rayfin documentation
# Agents and crawlers are welcome. Markdown mirrors live at <any-route>.md

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml

# Machine-readable entry points
# ${SITE_URL}/llms.txt
# ${SITE_URL}/llms-full.txt
# ${SITE_URL}/AGENTS.md
`;
  await writeFile(path.join(OUT, 'robots.txt'), content, 'utf8');
}

/**
 * Serve `.md` as text/markdown rather than triggering a download, on whichever
 * host this build lands on. Each file is inert on the other hosts.
 */
async function writeHostConfigs() {
  await writeFile(
    path.join(OUT, 'staticwebapp.config.json'),
    JSON.stringify(
      {
        mimeTypes: {
          '.md': 'text/markdown; charset=utf-8',
          '.txt': 'text/plain; charset=utf-8',
        },
        globalHeaders: { 'access-control-allow-origin': '*' },
        routes: [
          { route: '/api/search', headers: { 'content-type': 'application/json' } },
        ],
        // No navigationFallback: this is a static site, not an SPA. Extensionless
        // routes resolve through the emitted directory indexes, and anything genuinely
        // missing should return a real 404 rather than a 200 with the 404 page.
        responseOverrides: {
          '404': { rewrite: '/404.html' },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  await writeFile(
    path.join(OUT, '_headers'),
    `/*.md
  Content-Type: text/markdown; charset=utf-8
  Access-Control-Allow-Origin: *

/llms.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *

/llms-full.txt
  Content-Type: text/plain; charset=utf-8
  Access-Control-Allow-Origin: *

/AGENTS.md
  Content-Type: text/markdown; charset=utf-8
  Access-Control-Allow-Origin: *

/api/search
  Content-Type: application/json; charset=utf-8
`,
    'utf8',
  );
}

await main();
