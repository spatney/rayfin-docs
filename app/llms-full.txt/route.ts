import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';
import { siteConfig, absoluteUrl } from '@/lib/site.config';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  const pages = source.getPages();
  const scanned = await Promise.all(pages.map(getLLMText));

  const header = `<!--
${siteConfig.name} documentation — complete corpus.
Generated from ${absoluteUrl('/docs')}.
Documented against @microsoft/rayfin-* v${siteConfig.sdkVersion}, @microsoft/rayfin-cli v${siteConfig.cliVersion}.
Every page below is also available individually by appending .md to its URL.
${pages.length} pages.
-->

`;

  return new Response(header + scanned.join('\n\n---\n\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
