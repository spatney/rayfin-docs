import { source } from '@/lib/source';
import { siteConfig, absoluteUrl } from '@/lib/site.config';
import { lastModified } from '@/lib/last-modified';

type Page = ReturnType<typeof source.getPages>[number];

/**
 * Render a docs page as standalone Markdown for agent consumption.
 *
 * The frontmatter block is the contract agents rely on: it identifies the page,
 * its canonical HTML URL, the SDK and CLI versions it documents, when it was last
 * changed, and where it came from. The version and date stamps matter because an
 * agent that mixes API shapes across SDK releases produces code that does not
 * compile — it needs to know exactly which release a snippet was written against.
 */
export async function getLLMText(page: Page): Promise<string> {
  const processed = await page.data.getText('processed');
  const section = page.slugs[0] ?? 'docs';

  const frontmatter = [
    '---',
    `title: ${quote(page.data.title ?? 'Untitled')}`,
    `description: ${quote(page.data.description ?? '')}`,
    `url: ${absoluteUrl(page.url)}`,
    `markdown_url: ${absoluteUrl(`${page.url}.md`)}`,
    `section: ${section}`,
    `product: Rayfin`,
    `sdk_version: ${siteConfig.sdkVersion}`,
    `cli_version: ${siteConfig.cliVersion}`,
    `last_updated: ${lastModified(page.path)}`,
    `source: ${page.path}`,
    '---',
  ].join('\n');

  return `${frontmatter}

# ${page.data.title}

${page.data.description ? `> ${page.data.description}\n` : ''}
${unescapeAlerts(processed.trim())}
`;
}

/**
 * The mdast stringifier escapes the leading bracket of GFM alerts (`> \[!NOTE]`),
 * which stops downstream markdown parsers from recognising them. Restore the
 * original syntax so callouts survive into the `.md` mirrors.
 */
function unescapeAlerts(markdown: string): string {
  return markdown.replace(
    /^(\s*>\s*)\\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gm,
    '$1[!$2]',
  );
}

function quote(value: string): string {
  return JSON.stringify(value);
}
