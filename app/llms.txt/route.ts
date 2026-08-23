import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';
import { siteConfig, absoluteUrl } from '@/lib/site.config';

export const dynamic = 'force-static';
export const revalidate = false;

const header = `# ${siteConfig.name}

> ${siteConfig.description}

Rayfin is a backend-as-a-service for TypeScript developers. You define entities as
decorated TypeScript classes; Rayfin generates the database schema, REST and GraphQL
APIs, type-safe clients, auth, and static hosting. It runs locally on Docker or as a
managed Fabric app on Microsoft Fabric.

## How to use these docs as an agent

- Append \`.md\` to **any** documentation route to get that page as clean Markdown.
  Example: ${absoluteUrl('/docs/data/querying')} -> ${absoluteUrl('/docs/data/querying.md')}
- [llms-full.txt](${absoluteUrl('/llms-full.txt')}) contains the entire documentation set in one file.
- [AGENTS.md](${absoluteUrl('/AGENTS.md')}) contains the short operating rules for writing Rayfin code.
- Start with [Rules for agents](${absoluteUrl('/docs/ai/rules')}) before generating any Rayfin code.

Documented against \`@microsoft/rayfin-*\` v${siteConfig.sdkVersion} and \`@microsoft/rayfin-cli\` v${siteConfig.cliVersion}.

`;

export function GET() {
  return new Response(header + llms(source).index(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
