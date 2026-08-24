/**
 * Build-output gate: prove the agent surface actually shipped.
 *
 * Runs against `out/` after `next build` + `emit:agent`. A page that renders as HTML
 * but has no valid `.md` mirror is invisible to agents, which is the one failure this
 * site cannot tolerate.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');

const REQUIRED_FRONTMATTER = [
  'title',
  'description',
  'url',
  'markdown_url',
  'sdk_version',
  'cli_version',
  'last_updated',
];

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rayfin.ai').replace(
  /\/$/,
  '',
);

const errors: string[] = [];

async function main() {
  if (!existsSync(OUT)) {
    throw new Error('No out/ directory. Run `npm run build` first.');
  }

  const htmlRoutes = await collectDocsHtmlRoutes();
  if (htmlRoutes.length === 0) errors.push('no rendered docs pages found in out/');

  await checkMirrors(htmlRoutes);
  await checkRootAssets();
  await checkBundles();
  await checkLlmsCoverage(htmlRoutes);
  await checkSitemap(htmlRoutes);

  if (errors.length > 0) {
    for (const e of errors) console.error(`error  ${e}`);
    console.error(`\n[verify-agent] FAILED with ${errors.length} error(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`[verify-agent] ${htmlRoutes.length} docs pages, all mirrors valid`);
  console.log('[verify-agent] llms.txt, llms-full.txt, section bundles, AGENTS.md, sitemap.xml, robots.txt present');
  console.log('[verify-agent] sitemap locations match canonical URLs');
}

/** Every rendered docs page, as a site route: /docs, /docs/data/querying, ... */
async function collectDocsHtmlRoutes(): Promise<string[]> {
  const routes: string[] = [];

  if (existsSync(path.join(OUT, 'docs.html'))) routes.push('/docs');

  async function walk(dir: string, segments: string[]) {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, [...segments, entry.name]);
      } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
        // index.html files are the extensionless-route copies emitted by
        // emit-agent-assets; the canonical page is the sibling <name>.html.
        routes.push(`/docs/${[...segments, entry.name.replace(/\.html$/, '')].join('/')}`);
      }
    }
  }

  await walk(path.join(OUT, 'docs'), []);
  return routes.sort();
}

async function checkMirrors(routes: string[]) {
  for (const route of routes) {
    const mirror = path.join(OUT, `${route.replace(/^\//, '')}.md`);

    if (!existsSync(mirror)) {
      errors.push(`${route} has no markdown mirror at ${route}.md`);
      continue;
    }

    const body = await readFile(mirror, 'utf8');

    if (!body.startsWith('---\n')) {
      errors.push(`${route}.md does not start with a YAML frontmatter block`);
      continue;
    }

    const end = body.indexOf('\n---', 4);
    if (end === -1) {
      errors.push(`${route}.md has an unterminated frontmatter block`);
      continue;
    }

    const frontmatter = body.slice(4, end);
    for (const key of REQUIRED_FRONTMATTER) {
      if (!new RegExp(`^${key}:`, 'm').test(frontmatter)) {
        errors.push(`${route}.md frontmatter is missing \`${key}\``);
      }
    }

    if (/^description:\s*""\s*$/m.test(frontmatter)) {
      errors.push(`${route}.md has an empty description`);
    }

    // A stamp that is not a real date is worse than none: agents use it to decide
    // whether a snippet still matches the shipped SDK.
    const stamp = frontmatter.match(/^last_updated:\s*(.+)$/m)?.[1]?.trim();
    if (stamp && Number.isNaN(Date.parse(stamp))) {
      errors.push(`${route}.md has an unparseable last_updated: ${stamp}`);
    }

    const content = body.slice(end + 4).trim();
    if (content.length < 80) {
      errors.push(`${route}.md body is only ${content.length} chars — likely an empty page`);
    }
  }
}

async function checkRootAssets() {
  const required = [
    'llms.txt',
    'llms-full.txt',
    'AGENTS.md',
    'sitemap.xml',
    'robots.txt',
    'staticwebapp.config.json',
    '_headers',
  ];

  for (const name of required) {
    const file = path.join(OUT, name);
    if (!existsSync(file)) {
      errors.push(`missing ${name} in out/`);
      continue;
    }
    const { size } = await stat(file);
    if (size === 0) errors.push(`${name} is empty`);
  }

  // The mirror tree is an implementation detail and must not ship.
  if (existsSync(path.join(OUT, 'llms.mdx'))) {
    errors.push('out/llms.mdx was not cleaned up by emit-agent-assets');
  }
}

/**
 * Section bundles must exist, carry a `.txt` extension, and partition the corpus:
 * a section with no bundle is a section an agent can only reach by downloading
 * everything.
 */
async function checkBundles() {
  const dir = path.join(OUT, 'llms-full');

  if (!existsSync(dir)) {
    errors.push('missing out/llms-full/ section bundles');
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const bundles = new Set(
    entries.filter((e) => e.isFile() && e.name.endsWith('.txt')).map((e) => e.name),
  );

  for (const entry of entries) {
    if (entry.isFile() && !entry.name.endsWith('.txt')) {
      errors.push(`out/llms-full/${entry.name} was not renamed to .txt`);
    }
  }

  // Sections are the first path segment of every mirror below /docs. Next's own
  // build artifacts (`_next`, `__next.*`) share the tree and are not sections.
  const sections = new Set<string>(['docs']);
  async function walk(dir: string, depth: number) {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      if (depth === 0) sections.add(entry.name);
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }
  await walk(path.join(OUT, 'docs'), 0);

  for (const section of sections) {
    if (!bundles.has(`${section}.txt`)) {
      errors.push(`no bulk download at /llms-full/${section}.txt for section ${section}`);
    }
  }
}

async function checkLlmsCoverage(routes: string[]) {
  const index = path.join(OUT, 'llms.txt');
  if (!existsSync(index)) return;

  const body = await readFile(index, 'utf8');
  for (const route of routes) {
    if (!body.includes(`(${route})`)) {
      errors.push(`llms.txt does not list ${route}`);
    }
  }

  if (!body.includes('## Bulk downloads')) {
    errors.push('llms.txt does not advertise the bulk downloads with their sizes');
  }
}

/**
 * The sitemap must agree with the canonical URL of every page it lists.
 *
 * A trailing slash here contradicts `trailingSlash: false` and the `<link rel="canonical">`
 * in each page's head, which makes a crawler resolve a conflict on every URL. Markdown
 * mirrors must stay out entirely — they duplicate the HTML.
 */
async function checkSitemap(routes: string[]) {
  const file = path.join(OUT, 'sitemap.xml');
  if (!existsSync(file)) return;

  const body = await readFile(file, 'utf8');
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const loc of locs) {
    if (loc !== `${SITE_URL}/` && loc.endsWith('/')) {
      errors.push(`sitemap ${loc} has a trailing slash but canonical URLs do not`);
    }
    if (loc.endsWith('.md') && loc !== `${SITE_URL}/AGENTS.md`) {
      errors.push(`sitemap lists the markdown mirror ${loc}, which duplicates the HTML page`);
    }
  }

  const listed = new Set(locs);
  for (const route of routes) {
    if (!listed.has(`${SITE_URL}${route}`)) {
      errors.push(`sitemap does not list ${route}`);
    }
  }

  const urls = [...body.matchAll(/<url>[\s\S]*?<\/url>/g)];
  const missingLastmod = urls.filter((u) => !u[0].includes('<lastmod>')).length;
  if (missingLastmod > 0) {
    errors.push(`${missingLastmod} sitemap entries have no <lastmod>`);
  }
}

await main();
