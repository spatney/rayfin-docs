'use client';

import { useState } from 'react';
import { AGENT_LINKS } from '@/lib/agent-links';

const BUTTON =
  'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground';

/** Copy / open-in-assistant controls for a prompt whose text is known up front. */
export function PromptActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center rounded-md border border-fd-border bg-fd-secondary/60 px-2.5 py-1 text-xs font-medium text-fd-foreground transition-colors hover:border-teal-500/40"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-fd-border" />
      {AGENT_LINKS.map((agent) => (
        <a
          key={agent.id}
          href={agent.href(text)}
          target="_blank"
          rel="noopener noreferrer"
          className={BUTTON}
        >
          {agent.label}
        </a>
      ))}
    </span>
  );
}

/** Copy control for a shell command. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy: ${command}`}
      className="group flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-fd-border bg-fd-card/60 px-3.5 py-2.5 text-left backdrop-blur transition-colors hover:border-teal-500/40"
    >
      <code className="min-w-0 truncate font-mono text-[13px] text-fd-foreground">
        <span className="select-none text-fd-muted-foreground">$ </span>
        {command}
      </code>
      <span className="shrink-0 text-xs font-medium text-fd-muted-foreground transition-colors group-hover:text-fd-foreground">
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
