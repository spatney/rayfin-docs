import { readFileSync } from 'node:fs';
import path from 'node:path';
import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';
import { siteConfig, absoluteUrl } from '@/lib/site.config';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs');

type Page = ReturnType<typeof source.getPages>[number];

/**
 * Section-sized slices of the full corpus.
 *
 * `/llms-full.txt` is the complete set, which is well past what an agent can spend
 * on a single fetch — most will truncate it or skip it entirely. The bundles are a
 * strict partition of that same corpus along section boundaries, so an agent that
 * only needs the data-modelling docs can pull `/llms-full/data.txt` instead. The
 * sizes are published in `/llms.txt` so the choice can be made before fetching.
 */
export type Bundle = {
  /** First URL segment under /docs, e.g. `data`. */
  section: string;
  title: string;
  /** Public path of the rendered bundle. */
  url: string;
  pages: Page[];
};

/** Section of the docs a page belongs to. The root index page forms its own. */
function sectionOf(page: Page): string {
  return page.slugs[0] ?? 'docs';
}

/**
 * Bundles in sidebar order.
 *
 * Ordering follows the page tree rather than the alphabet so the listing in
 * llms.txt reads in the same sequence a human would work through the site.
 */
export function getBundles(): Bundle[] {
  const pages = source.getPages();

  const grouped = new Map<string, Page[]>();
  for (const page of pages) {
    const section = sectionOf(page);
    const existing = grouped.get(section);
    if (existing) existing.push(page);
    else grouped.set(section, [page]);
  }

  const ordered = readPageTree(pages).filter((section) => grouped.has(section));
  for (const section of [...grouped.keys()].sort()) {
    if (!ordered.includes(section)) ordered.push(section);
  }

  return ordered.map((section) => ({
    section,
    title: titleOf(section),
    url: `/llms-full/${section}.txt`,
    pages: grouped.get(section) ?? [],
  }));
}

type TreeNode = ReturnType<typeof source.getPageTree>['children'][number];

/** Section slugs in sidebar order, by walking the tree and mapping each page URL back. */
function readPageTree(pages: Page[]): string[] {
  const bySlug = new Map(pages.map((page) => [page.url, sectionOf(page)]));
  const order: string[] = [];

  const record = (section: string | undefined) => {
    if (section && !order.includes(section)) order.push(section);
  };

  const visit = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.type === 'page') {
        record(bySlug.get(node.url));
      } else if (node.type === 'folder') {
        const url = node.index?.url ?? firstPageUrl(node.children);
        record(url ? bySlug.get(url) : undefined);
        visit(node.children);
      }
    }
  };

  visit(source.getPageTree().children);
  return order;
}

function firstPageUrl(nodes: TreeNode[]): string | undefined {
  for (const node of nodes) {
    if (node.type === 'page') return node.url;
    if (node.type === 'folder') {
      const url = node.index?.url ?? firstPageUrl(node.children);
      if (url) return url;
    }
  }
  return undefined;
}

/**
 * Display name for a section.
 *
 * The page tree is not a reliable source here: the root meta.json flattens several
 * sections into separator groups, so `start` has no folder node at all, and
 * `reference` is represented by its nested `cli` and `sdk` folders. Reading the
 * section's own meta.json is unambiguous.
 */
function titleOf(section: string): string {
  if (section === 'docs') return 'Overview';

  return (
    readMeta(section).title ??
    source.getPage([section])?.data.title ??
    separatorLabel(section) ??
    section.charAt(0).toUpperCase() + section.slice(1)
  );
}

function readMeta(...segments: string[]): { title?: string; pages?: string[] } {
  try {
    return JSON.parse(
      readFileSync(path.join(CONTENT_DIR, ...segments, 'meta.json'), 'utf8'),
    ) as { title?: string; pages?: string[] };
  } catch {
    return {};
  }
}

/** The `---Label---` group a section sits under in the root meta.json, if any. */
function separatorLabel(section: string): string | undefined {
  let current: string | undefined;

  for (const entry of readMeta().pages ?? []) {
    const separator = entry.match(/^---(.+)---$/);
    if (separator) {
      current = separator[1];
    } else if (entry === section || entry.startsWith(`${section}/`)) {
      return current;
    }
  }

  return undefined;
}

/** Render one bundle: the same Markdown as the individual mirrors, concatenated. */
export async function renderBundle(bundle: Bundle): Promise<string> {
  return render(
    bundle.pages,
    `${siteConfig.name} documentation — ${bundle.title} section.`,
    absoluteUrl(bundle.url),
  );
}

/** Render the complete corpus. */
export async function renderFullCorpus(): Promise<string> {
  return render(
    source.getPages(),
    `${siteConfig.name} documentation — complete corpus.`,
    absoluteUrl('/llms-full.txt'),
  );
}

async function render(pages: Page[], summary: string, self: string): Promise<string> {
  const bodies = await Promise.all(pages.map(getLLMText));

  const header = `<!--
${summary}
Generated from ${absoluteUrl('/docs')} — this file is ${self}.
Documented against @microsoft/rayfin-* v${siteConfig.sdkVersion}, @microsoft/rayfin-cli v${siteConfig.cliVersion}.
Every page below is also available individually by appending .md to its URL.
${pages.length} page${pages.length === 1 ? '' : 's'}.
-->

`;

  return header + bodies.join('\n\n---\n\n');
}

/** `123.4 KB (~31k tokens)` — enough for an agent to budget a fetch. */
export function describeSize(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8');
  const kb = (bytes / 1024).toFixed(1);
  // Four characters per token is the usual rule of thumb for English prose and code.
  const tokens = Math.round(text.length / 4);

  return `${kb} KB (~${tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : tokens} tokens)`;
}
