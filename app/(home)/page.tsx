import Link from 'next/link';
import { siteConfig } from '@/lib/site.config';

const PATHS = [
  {
    href: '/docs/start/quickstart',
    title: 'Quickstart',
    body: 'Scaffold a project, run the stack locally, and see data flowing in minutes.',
  },
  {
    href: '/docs/data/modeling',
    title: 'Model your data',
    body: 'Decorate a TypeScript class and get a table, a GraphQL API, and a typed client.',
  },
  {
    href: '/docs/deploy',
    title: 'Deploy to Fabric',
    body: 'One command builds your app, ships it, and applies pending schema changes.',
  },
];

const AGENT_LINKS = [
  { href: '/llms.txt', label: '/llms.txt' },
  { href: '/llms-full.txt', label: '/llms-full.txt' },
  { href: '/docs/ai/rules', label: 'Rules for agents' },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 sm:py-24">
      <section className="flex max-w-3xl flex-col items-center text-center">
        <span className="mb-5 rounded-full border border-fd-border px-3 py-1 text-xs font-medium text-fd-muted-foreground">
          Backend-as-a-service for TypeScript, on Microsoft Fabric
        </span>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Model your data once.
          <br />
          Get the whole backend.
        </h1>
        <p className="mt-5 max-w-xl text-balance text-fd-muted-foreground">
          Define entities as decorated TypeScript classes. {siteConfig.name} generates the
          database schema, REST and GraphQL APIs, type-safe clients, auth, and hosting —
          locally or as a managed Fabric app.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
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

        <code className="mt-8 rounded-lg border border-fd-border bg-fd-card px-4 py-2.5 font-mono text-sm text-fd-muted-foreground">
          npm create @microsoft/rayfin@latest
        </code>
      </section>

      <section className="mt-20 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {PATHS.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className="rounded-xl border border-fd-border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
          >
            <h2 className="font-semibold">{path.title}</h2>
            <p className="mt-1.5 text-sm text-fd-muted-foreground">{path.body}</p>
          </Link>
        ))}
      </section>

      <section className="mt-16 w-full max-w-4xl rounded-2xl border border-fd-border bg-fd-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Built for agents</h2>
        <p className="mt-2 max-w-2xl text-sm text-fd-muted-foreground">
          Append <code className="font-mono">.md</code> to any route on this site to get
          that page as clean Markdown. Point a coding agent at{' '}
          <code className="font-mono">/llms.txt</code> and it can operate the{' '}
          {siteConfig.name} SDK and CLI without any other source.
        </p>

        <pre className="mt-5 overflow-x-auto rounded-lg border border-fd-border bg-fd-secondary/50 p-4 font-mono text-xs leading-relaxed">
          <code>curl {siteConfig.baseUrl}/docs/data/querying.md</code>
        </pre>

        <div className="mt-5 flex flex-wrap gap-2">
          {AGENT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md border border-fd-border px-3 py-1.5 font-mono text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
