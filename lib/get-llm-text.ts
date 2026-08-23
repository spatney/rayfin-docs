import { source } from '@/lib/source';
import { siteConfig, absoluteUrl } from '@/lib/site.config';

type Page = ReturnType<typeof source.getPages>[number];

/**
 * Render a docs page as standalone Markdown for agent consumption.
 *
 * The frontmatter block is the contract agents rely on: it identifies the page,
 * its canonical HTML URL, the SDK version it documents, and where it came from.
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
