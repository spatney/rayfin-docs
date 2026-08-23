import Link from 'next/link';
import Image from 'next/image';
import { CopyCommand, PromptActions } from '@/components/start-actions';
import { siteConfig } from '@/lib/site.config';
import logo from '@/public/rayfin-logo.png';

const CREATE_COMMAND = 'npm create @microsoft/rayfin@latest my-app';

const GET_STARTED_PROMPT = `Set up a new Rayfin app for me, end to end.

Rayfin is a backend platform for TypeScript developers on Microsoft Fabric. Before writing any code, read https://purple-grass-01682270f.7.azurestaticapps.net/llms.txt and https://purple-grass-01682270f.7.azurestaticapps.net/docs/ai/rules.md — every page on that site is available as raw Markdown by appending .md to its URL.

Then do the work yourself rather than printing steps for me:
1. Scaffold a project with \`npm create @microsoft/rayfin@latest my-app\` and install dependencies.
2. Sign in with \`npx rayfin login\`.
3. Deploy the backend with \`npx rayfin up\` and confirm it with \`npx rayfin up status\`.
4. Start the frontend with \`npm run dev\` and tell me the URL to open.

Then explain what the starter app does and where the data model lives.`;

const STEPS = [
  { command: 'npx rayfin login', label: 'Sign in to Microsoft Fabric' },
  { command: 'npx rayfin up', label: 'Deploy the backend' },
  { command: 'npm run dev', label: 'Run the frontend' },
];

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-x-hidden px-4 py-16 sm:px-6 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,theme(colors.teal.500/0.14),transparent)]"
      />

      <section className="flex w-full max-w-3xl flex-col items-center text-center">
        <Image
          src={logo}
          alt=""
          aria-hidden
          width={80}
          height={80}
          className="mb-6 size-14 sm:mb-7 sm:size-16"
          priority
        />
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-[3.25rem] sm:leading-[1.08]">
          Agent-first apps for the enterprise
        </h1>
        <p className="mt-4 max-w-xl text-balance text-base text-fd-muted-foreground sm:mt-5 sm:text-lg">
          {siteConfig.name} is a backend platform built for the agentic era. Define your
          data model in TypeScript and get a database, APIs, type-safe clients, auth, and
          hosting — managed on Microsoft Fabric.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/start/quickstart"
            className="rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Read the docs
          </Link>
        </div>
      </section>

      <section className="mt-14 grid w-full max-w-5xl items-start gap-4 sm:mt-20 sm:gap-5 lg:grid-cols-2">
        {/* Path 1 — a person, at a terminal. */}
        <div className="flex h-full min-w-0 flex-col rounded-2xl border border-fd-border bg-fd-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Start in your terminal</h2>
          <p className="mt-1.5 text-sm text-fd-muted-foreground">
            Scaffold a project, deploy it, and run the frontend locally against it.
          </p>

          <div className="mt-5 min-w-0">
            <CopyCommand command={CREATE_COMMAND} />
          </div>

          <ol className="mt-4 space-y-3">
            {STEPS.map((step, i) => (
              <li key={step.command} className="flex min-w-0 items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-fd-border text-[11px] font-medium text-fd-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <code className="break-all font-mono text-[13px] text-fd-foreground">
                    {step.command}
                  </code>
                  <span className="block text-fd-muted-foreground">{step.label}</span>
                </span>
              </li>
            ))}
          </ol>

          <Link
            href="/docs/start/quickstart"
            className="mt-auto pt-5 text-sm font-medium text-fd-primary hover:underline"
          >
            Read the quickstart →
          </Link>
        </div>

        {/* Path 2 — an agent. */}
        <div className="flex h-full min-w-0 flex-col rounded-2xl border border-fd-border bg-fd-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Start with an agent</h2>
          <p className="mt-1.5 text-sm text-fd-muted-foreground">
            Paste this into Copilot, ChatGPT, or Claude. It builds and deploys your first
            app for you.
          </p>

          <figure className="mt-5 min-w-0 overflow-hidden rounded-lg border border-fd-border bg-fd-secondary/40">
            <figcaption className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-fd-border px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-fd-muted-foreground">
                Prompt
              </span>
              <PromptActions text={GET_STARTED_PROMPT} />
            </figcaption>
            <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12.5px] leading-relaxed text-fd-muted-foreground">
              {GET_STARTED_PROMPT}
            </pre>
          </figure>

          <Link
            href="/docs/ai"
            className="mt-auto pt-5 text-sm font-medium text-fd-primary hover:underline"
          >
            More on using agents →
          </Link>
        </div>
      </section>
    </main>
  );
}
