'use client';

import { useState } from 'react';
import { siteConfig } from '@/lib/site.config';

const AGENTS = [
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    href: (prompt: string) =>
      `https://github.com/copilot?prompt=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    href: (prompt: string) =>
      `https://chatgpt.com/?hints=search&q=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'claude',
    label: 'Claude',
    href: (prompt: string) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
] as const;

export function PageActions({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const mdPath = `${url}.md`;
  const absolute = `${siteConfig.baseUrl}${mdPath}`;
  const prompt = `Read ${absolute} and help me with: `;

  async function copyMarkdown() {
    try {
      const res = await fetch(mdPath);
      if (!res.ok) throw new Error(`${res.status}`);
      await navigator.clipboard.writeText(await res.text());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fall back to sending the reader to the raw file.
      window.open(mdPath, '_blank', 'noopener');
    }
  }

  return (
    <div className="not-prose mb-6 flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        onClick={copyMarkdown}
        aria-label={`Copy "${title}" as Markdown`}
        className="inline-flex items-center gap-1.5 rounded-md border border-fd-border bg-fd-secondary px-2.5 py-1.5 font-medium text-fd-secondary-foreground transition-colors hover:bg-fd-accent"
      >
        {copied ? 'Copied' : 'Copy as Markdown'}
      </button>

      <a
        href={mdPath}
        className="inline-flex items-center gap-1.5 rounded-md border border-fd-border px-2.5 py-1.5 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
      >
        View as Markdown
      </a>

      <span className="mx-1 hidden text-fd-muted-foreground sm:inline">Open in</span>

      {AGENTS.map((agent) => (
        <a
          key={agent.id}
          href={agent.href(prompt)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-fd-border px-2.5 py-1.5 font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
        >
          {agent.label}
        </a>
      ))}
    </div>
  );
}
