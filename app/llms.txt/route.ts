import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';
import { siteConfig, absoluteUrl } from '@/lib/site.config';
import {
  describeSize,
  getBundles,
  renderBundle,
  renderFullCorpus,
} from '@/lib/llms-bundles';

export const dynamic = 'force-static';
export const revalidate = false;

const header = `# ${siteConfig.name}

> ${siteConfig.description}

Rayfin is a backend platform for TypeScript developers. You define entities as decorated
TypeScript classes; Rayfin generates the database schema, REST and GraphQL APIs, and
type-safe clients, then runs them on Microsoft Fabric with auth, functions, blob storage,
and static hosting built in.

## How to use these docs as an agent

- Append \`.md\` to **any** documentation route to get that page as clean Markdown.
  Example: ${absoluteUrl('/docs/data/querying')} -> ${absoluteUrl('/docs/data/querying.md')}
- [AGENTS.md](${absoluteUrl('/AGENTS.md')}) contains the short operating rules for writing Rayfin code.
- Start with [Rules for coding agents](${absoluteUrl('/docs/reference/agent-rules')}) before generating any Rayfin code.
- Every page carries \`sdk_version\`, \`cli_version\` and \`last_updated\` in its frontmatter.
  Do not mix API shapes across SDK versions.

Documented against \`@microsoft/rayfin-*\` v${siteConfig.sdkVersion} and \`@microsoft/rayfin-cli\` v${siteConfig.cliVersion}.

`;

/**
 * Sized listing of the bulk downloads.
 *
 * An agent choosing between the corpus and a section needs the cost up front —
 * without it the usual outcome is a truncated fetch of llms-full.txt, which silently
 * drops whichever pages happen to sort last.
 */
async function bundleIndex(): Promise<string> {
  const bundles = getBundles();

  const rendered = await Promise.all(
    bundles.map(async (bundle) => ({
      bundle,
      size: describeSize(await renderBundle(bundle)),
    })),
  );

  const rows = rendered
    .map(
      ({ bundle, size }) =>
        `- [${bundle.title}](${absoluteUrl(bundle.url)}): ${bundle.pages.length} page${
          bundle.pages.length === 1 ? '' : 's'
        }, ${size}`,
    )
    .join('\n');

  return `## Bulk downloads

Prefer a section bundle over the full corpus unless you genuinely need everything.

- [llms-full.txt](${absoluteUrl('/llms-full.txt')}): every page in one file, ${describeSize(
    await renderFullCorpus(),
  )}

${rows}

`;
}

export async function GET() {
  return new Response(header + (await bundleIndex()) + llms(source).index(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
