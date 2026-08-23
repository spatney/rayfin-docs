'use client';

import { useRef, useState, type ReactNode } from 'react';

/**
 * Renders a ```prompt fence as a copyable prompt card.
 *
 * Prompts are authored as plain fenced code blocks so that they survive verbatim
 * into the `.md` mirrors — an agent reading the markdown sees the same prompt a
 * human sees on the page. Only the presentation is upgraded here.
 */
export function PromptCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function readPrompt(): string {
    return (bodyRef.current?.textContent ?? '').trim();
  }

  async function copy() {
    const text = readPrompt();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openIn(build: (prompt: string) => string) {
    const text = readPrompt();
    if (!text) return;
    window.open(build(text), '_blank', 'noopener,noreferrer');
  }

  return (
    <figure className="not-prose my-5 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
      <figcaption className="flex flex-wrap items-center gap-2 border-b border-fd-border bg-fd-secondary/60 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-fd-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-fd-primary">
          Prompt
        </span>
        {title ? (
          <span className="text-sm font-medium text-fd-foreground">{title}</span>
        ) : null}

        <span className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={copy}
            className="rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() =>
              openIn((p) => `https://github.com/copilot?prompt=${encodeURIComponent(p)}`)
            }
            className="rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Copilot
          </button>
          <button
            type="button"
            onClick={() =>
              openIn((p) => `https://chatgpt.com/?q=${encodeURIComponent(p)}`)
            }
            className="rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            ChatGPT
          </button>
          <button
            type="button"
            onClick={() =>
              openIn((p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`)
            }
            className="rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            Claude
          </button>
        </span>
      </figcaption>

      <div
        ref={bodyRef}
        className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-fd-foreground [&_pre]:!bg-transparent [&_pre]:!p-0 [&_span]:!text-fd-foreground [&_code]:!bg-transparent"
      >
        {children}
      </div>
    </figure>
  );
}
