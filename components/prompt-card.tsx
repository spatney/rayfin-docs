'use client';

import { useRef, useState, type ReactNode } from 'react';

import {
  COPILOT_APP_HINT,
  COPILOT_APP_LABEL,
  COPILOT_APP_URL,
} from '@/lib/agent-links';

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

  /**
   * The app link carries no prompt, so hand it over on the clipboard instead.
   *
   * `window.open` stays synchronous — awaiting the clipboard write first would end the
   * user-gesture context and get the popup blocked.
   */
  function openCopilotApp() {
    const text = readPrompt();
    if (text) {
      void navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {});
    }
    window.open(COPILOT_APP_URL, '_blank', 'noopener,noreferrer');
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
            onClick={openCopilotApp}
            title={COPILOT_APP_HINT}
            className="rounded-md px-2 py-1 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
          >
            {COPILOT_APP_LABEL}
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
