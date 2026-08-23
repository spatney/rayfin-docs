/**
 * Content lint for content/docs.
 *
 * Enforces the authoring contract in AGENTS.md — the rules that keep the rendered
 * page and its `.md` mirror equivalent, and keep /llms.txt useful.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content', 'docs');

/** MDX components a page may use. Anything else degrades badly in the .md mirror. */
const ALLOWED_COMPONENTS = new Set(['Tabs', 'Tab', 'Cards', 'Card', 'Steps', 'Step']);

const MAX_DESCRIPTION = 200;

/**
 * Terms that are out of documented scope (see "Product scope" in AGENTS.md).
 * Rayfin documents one way to run — as a managed Fabric app — and one auth method,
 * Fabric SSO. This gate stops local/Docker and password-auth content creeping back in.
 */
const OUT_OF_SCOPE: { pattern: RegExp; reason: string }[] = [
  { pattern: /\brayfin\s+dev\b/i, reason: 'the `rayfin dev` local stack is out of scope' },
  { pattern: /\bdocker\b/i, reason: 'Docker / local containers are out of scope' },
  { pattern: /\bdocker-local-dev\b/i, reason: 'the docker-local-dev feature flag is out of scope' },
  { pattern: /\bazurite\b/i, reason: 'Azurite (local storage emulator) is out of scope' },
  { pattern: /\bmaildev\b/i, reason: 'MailDev (local mail catcher) is out of scope' },
  { pattern: /\bpostgres(ql)?\b/i, reason: 'Fabric supports mssql only' },
  { pattern: /\bRayfin Local\b/i, reason: 'Rayfin Local is out of scope — Rayfin runs as a Fabric app' },
  { pattern: /\bsendMagicLink\b|\bhandleMagicLinkCallback\b/, reason: 'magic-link auth is out of scope' },
  { pattern: /\bsignUp\b/, reason: 'password sign-up is out of scope — Fabric SSO only' },
  { pattern: /email[ /-]?(and[ -])?password auth/i, reason: 'email/password auth is out of scope' },
];

type Problem = { file: string; line?: number; message: string };

const problems: Problem[] = [];
const warnings: Problem[] = [];

async function main() {
  const files = await collectMdx(CONTENT);
  if (files.length === 0) throw new Error(`No MDX files found under ${CONTENT}`);

  const routes = new Set(files.map(toRoute));

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');

    let data: Record<string, unknown>;
    let content: string;
    try {
      const parsed = matter(raw);
      data = parsed.data;
      content = parsed.content;
    } catch (error) {
      // Unquoted values containing `: ` are the usual cause. This would also break
      // the Next build, so surface it as an error rather than crashing the lint.
      problems.push({
        file: rel,
        message: `invalid YAML frontmatter — ${(error as Error).message.split('\n')[0]}. Wrap values containing a colon in quotes.`,
      });
      continue;
    }

    checkFrontmatter(rel, data);
    checkCodeFences(rel, content);
    checkComponents(rel, content);
    checkLinks(rel, content, routes);
    checkScope(rel, raw);
  }

  await checkGeneratedCopy();

  report(files.length);
}

/**
 * Prose that ships to readers does not only live in content/docs — it is also
 * embedded in the files that generate llms.txt, AGENTS.md and the landing page.
 * Those escaped an earlier scope purge because the lint only walked MDX.
 */
async function checkGeneratedCopy() {
  const sources = [
    'app/llms.txt/route.ts',
    'app/llms-full.txt/route.ts',
    'app/(home)/page.tsx',
    'lib/site.config.ts',
    'scripts/emit-agent-assets.mts',
  ];

  for (const rel of sources) {
    const full = path.join(ROOT, rel);
    if (!existsSync(full)) continue;
    checkScope(rel, await readFile(full, 'utf8'));
  }
}

function checkFrontmatter(file: string, data: Record<string, unknown>) {
  const title = data.title;
  const description = data.description;

  if (typeof title !== 'string' || title.trim() === '') {
    problems.push({ file, message: 'missing frontmatter `title`' });
  }

  if (typeof description !== 'string' || description.trim() === '') {
    problems.push({
      file,
      message: 'missing frontmatter `description` (it is what agents read in /llms.txt)',
    });
  } else if (description.length > MAX_DESCRIPTION) {
    warnings.push({
      file,
      message: `description is ${description.length} chars (target <= ${MAX_DESCRIPTION})`,
    });
  }
}

function checkCodeFences(file: string, content: string) {
  const lines = content.split('\n');
  let inFence = false;
  let fenceMarker = '';

  lines.forEach((line, index) => {
    const match = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!match) return;

    const [, , marker, rest] = match;

    if (inFence) {
      // A closing fence has no info string.
      if (marker.startsWith(fenceMarker[0]) && rest.trim() === '') {
        inFence = false;
        fenceMarker = '';
      }
      return;
    }

    inFence = true;
    fenceMarker = marker;

    const lang = rest.trim().split(/\s+/)[0];
    if (!lang) {
      problems.push({
        file,
        line: index + 1,
        message: 'code fence has no language (agents rely on it to know what the block is)',
      });
    }
  });

  if (inFence) {
    problems.push({ file, message: 'unterminated code fence' });
  }
}

function checkComponents(file: string, content: string) {
  const stripped = stripCode(content);
  const seen = new Set<string>();

  for (const match of stripped.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)) {
    const name = match[1];
    if (ALLOWED_COMPONENTS.has(name) || seen.has(name)) continue;
    seen.add(name);
    problems.push({
      file,
      message: `<${name}> is not in the component allowlist — it would disappear from the .md mirror. Use a Markdown primitive, or add it to ALLOWED_COMPONENTS in scripts/check-docs.mts.`,
    });
  }

  if (/<Callout/.test(stripped)) {
    problems.push({ file, message: 'use a GFM alert (`> [!NOTE]`) instead of <Callout>' });
  }
}

function checkLinks(file: string, content: string, routes: Set<string>) {
  const stripped = stripCode(content);

  for (const match of stripped.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1];

    if (/^(https?:|mailto:|#)/.test(href)) continue;

    if (href.startsWith('./') || href.startsWith('../')) {
      problems.push({
        file,
        message: `relative link \`${href}\` — use an absolute site path like /docs/data/querying`,
      });
      continue;
    }

    if (!href.startsWith('/')) continue;

    const [pathname] = href.split('#');

    // Root-level build artefacts (/llms.txt, /AGENTS.md, /sitemap.xml) are emitted by
    // the build, not by content, so they have no page to resolve against.
    if (!pathname.startsWith('/docs')) continue;

    if (pathname.endsWith('.md')) {
      problems.push({
        file,
        message: `link to a markdown mirror \`${href}\` — link to the page route instead (${pathname.replace(/\.md$/, '')})`,
      });
      continue;
    }

    const normalized = pathname.replace(/\/$/, '');
    if (!routes.has(normalized)) {
      problems.push({ file, message: `broken internal link \`${href}\` — no such page` });
    }
  }
}

/** Remove fenced blocks and inline code spans so their contents are never linted. */
function stripCode(content: string): string {
  return content
    .replace(/^(\s*)(`{3,}|~{3,})[\s\S]*?\n\1\2\s*$/gm, '')
    .replace(/`[^`\n]*`/g, '');
}

/**
 * Scope gate. Scans the raw file including code fences, because an out-of-scope
 * command in a shell block is exactly what a reader would copy and run.
 * `npm run dev` and `localhost:5173` are in scope — that is local *frontend*
 * development against a deployed Fabric backend.
 */
function checkScope(file: string, raw: string) {
  const lines = raw.split('\n');

  lines.forEach((line, index) => {
    for (const { pattern, reason } of OUT_OF_SCOPE) {
      if (!pattern.test(line)) continue;
      problems.push({
        file,
        line: index + 1,
        message: `out of scope: ${reason} (matched ${pattern}). See "Product scope" in AGENTS.md.`,
      });
      // One report per line is enough to send someone to the right place.
      break;
    }
  });
}

async function collectMdx(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectMdx(full)));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

/** content/docs/data/querying.mdx -> /docs/data/querying */
function toRoute(file: string): string {
  const rel = path.relative(CONTENT, file).replace(/\\/g, '/').replace(/\.mdx$/, '');
  const withoutIndex = rel.replace(/(^|\/)index$/, '');
  return withoutIndex ? `/docs/${withoutIndex}` : '/docs';
}

function report(fileCount: number) {
  for (const w of warnings) {
    console.warn(`warn  ${w.file}${w.line ? `:${w.line}` : ''}  ${w.message}`);
  }
  for (const p of problems) {
    console.error(`error ${p.file}${p.line ? `:${p.line}` : ''}  ${p.message}`);
  }

  console.log(
    `\n[check-docs] ${fileCount} pages, ${problems.length} errors, ${warnings.length} warnings`,
  );

  if (problems.length > 0) process.exitCode = 1;
}

await main();
