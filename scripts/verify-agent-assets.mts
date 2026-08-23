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

const REQUIRED_FRONTMATTER = ['title', 'description', 'url', 'markdown_url', 'sdk_version'];

const errors: string[] = [];

async function main() {
  if (!existsSync(OUT)) {
    throw new Error('No out/ directory. Run `npm run build` first.');
  }

  const htmlRoutes = await collectDocsHtmlRoutes();
  if (htmlRoutes.length === 0) errors.push('no rendered docs pages found in out/');

  await checkMirrors(htmlRoutes);
  await checkRootAssets();
  await checkLlmsCoverage(htmlRoutes);

  if (errors.length > 0) {
    for (const e of errors) console.error(`error  ${e}`);
    console.error(`\n[verify-agent] FAILED with ${errors.length} error(s)`);
    process.exitCode = 1;
    return;
  }

  console.log(`[verify-agent] ${htmlRoutes.length} docs pages, all mirrors valid`);
  console.log('[verify-agent] llms.txt, llms-full.txt, AGENTS.md, sitemap.xml, robots.txt present');
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

async function checkLlmsCoverage(routes: string[]) {
  const index = path.join(OUT, 'llms.txt');
  if (!existsSync(index)) return;

  const body = await readFile(index, 'utf8');
  for (const route of routes) {
    if (!body.includes(`(${route})`)) {
      errors.push(`llms.txt does not list ${route}`);
    }
  }
}

await main();
