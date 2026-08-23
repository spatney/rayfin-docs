import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { CopyCommand, PromptActions } from '@/components/start-actions';
import { siteConfig } from '@/lib/site.config';
import logo from '@/public/rayfin-logo.png';

const CREATE_COMMAND = 'npm create @microsoft/rayfin@latest my-app';

const GET_STARTED_PROMPT = `Set up a new Rayfin app for me, end to end.

Rayfin is a backend platform for TypeScript developers on Microsoft Fabric. Before writing any code, read https://rayfin.ai/llms.txt and https://rayfin.ai/docs/reference/agent-rules.md — every page on that site is available as raw Markdown by appending .md to its URL.

Then do the work yourself rather than printing steps for me:
1. Scaffold a project with \`npm create @microsoft/rayfin@latest my-app\` and install dependencies.
2. Sign in with \`npx rayfin login\`.
3. Deploy the backend with \`npx rayfin up\` and confirm it with \`npx rayfin up status\`.
4. Start the frontend with \`npm run dev\` and tell me the URL to open.

Then explain what the starter app does and where the data model lives.`;

/**
 * Charges routed along the grid. Coordinates are local to a 1120px-wide centred track:
 * the grid is anchored to the horizontal centre with a 56px cell, which puts vertical
 * lines on `x = 28 + 56k` and horizontal lines on `y = 56n` inside that track.
 */
const GRID_ROUTES = [
  { d: 'M 308 -80 L 308 168 L 476 168 L 476 640', dur: '9s', delay: '0s' },
  { d: 'M 812 -80 L 812 280 L 644 280 L 644 640', dur: '11s', delay: '2.5s' },
  { d: 'M 140 -80 L 140 112 L 420 112 L 420 392 L 700 392 L 700 640', dur: '15s', delay: '5s' },
  { d: 'M 980 -80 L 980 224 L 868 224 L 868 640', dur: '10s', delay: '7.5s' },
  { d: 'M 588 -80 L 588 336 L 252 336 L 252 640', dur: '13s', delay: '3.8s' },
] as const;

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-x-hidden px-4 pb-12 pt-14 sm:px-6 sm:pb-16 sm:pt-20">
      {/* Background: an energised grid under a soft teal bloom. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-20 h-[560px] overflow-hidden [mask-image:radial-gradient(ellipse_50%_55%_at_50%_0%,black,transparent)]"
      >
        <div className="rayfin-grid absolute inset-0 opacity-70" />
        <div className="rayfin-grid-charge absolute inset-0" />
        <div className="absolute left-1/2 top-0 h-[560px] w-[1120px] -translate-x-1/2">
          {GRID_ROUTES.map((route) => (
            <span
              key={route.d}
              className="rayfin-flow"
              style={
                {
                  offsetPath: `path('${route.d}')`,
                  '--rayfin-dur': route.dur,
                  '--rayfin-delay': route.delay,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,theme(colors.teal.500/0.11),transparent)]"
      />

      <section className="flex w-full max-w-3xl flex-col items-center text-center">
        <Image
          src={logo}
          alt=""
          aria-hidden
          width={96}
          height={96}
          className="mb-5 size-16 drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:size-20"
          priority
        />

        <h1 className="text-balance text-3xl font-bold tracking-tight text-fd-foreground sm:text-[3.25rem] sm:leading-[1.08]">
          Agent-first apps for the enterprise
        </h1>
        <p className="mt-4 max-w-xl text-balance text-base text-fd-muted-foreground sm:text-lg">
          Define your data model in TypeScript. {siteConfig.name} generates the database
          and type-safe APIs, then runs them on Microsoft Fabric — with auth, functions,
          storage, and hosting built in.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/docs/start/quickstart"
            className="group inline-flex items-center gap-1.5 rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Get started
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-fd-border bg-fd-card/60 px-5 py-2.5 text-sm font-medium backdrop-blur transition-colors hover:bg-fd-accent"
          >
            Read the docs
          </Link>
        </div>
      </section>

      {/* The one starting point: hand the prompt to an agent. */}
      <section className="mt-12 w-full max-w-3xl sm:mt-14">
        <div className="group relative overflow-hidden rounded-2xl border border-fd-border bg-fd-card/60 backdrop-blur-sm">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent"
          />

          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-fd-border px-4 py-2.5">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fd-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-teal-400/80" />
              Start with an agent
            </span>
            <PromptActions text={GET_STARTED_PROMPT} />
          </div>

          <div className="relative">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words px-4 py-4 pb-10 font-mono text-[12.5px] leading-relaxed text-fd-muted-foreground [mask-image:linear-gradient(to_bottom,black_calc(100%_-_2.5rem),transparent)] [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
              {GET_STARTED_PROMPT}
            </pre>
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-fd-muted-foreground">
          Paste it into Copilot, ChatGPT, or Claude — it scaffolds the project, deploys the
          backend, and explains what it built.
        </p>
      </section>

      {/* Secondary path, for people who would rather type it themselves. */}
      <section className="mt-10 w-full max-w-3xl sm:mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-sm text-fd-muted-foreground">
            Prefer your terminal?
          </span>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <CopyCommand command={CREATE_COMMAND} />
          </div>
          <Link
            href="/docs/start/quickstart"
            className="shrink-0 text-sm font-medium text-fd-primary hover:underline"
          >
            Quickstart →
          </Link>
        </div>
      </section>
    </main>
  );
}
