import { absoluteUrl, siteConfig } from '@/lib/site.config';

const { owner, name, branch, contentDir } = siteConfig.github;

/**
 * Per-page feedback links.
 *
 * The issue link is pre-filled with the page title, its live URL, and the source
 * file, so a report arrives actionable rather than as "something on the docs is
 * wrong". This is site chrome, not content — it deliberately does not appear in
 * the `.md` mirrors.
 */
export function PageFeedback({
  title,
  url,
  path,
}: {
  title: string;
  url: string;
  path: string;
}) {
  const source = `${contentDir}/${path}`;

  const issueUrl = new URL(`https://github.com/${owner}/${name}/issues/new`);
  issueUrl.searchParams.set('title', `Docs: ${title}`);
  issueUrl.searchParams.set('labels', 'documentation');
  issueUrl.searchParams.set(
    'body',
    [
      `**Page:** [${title}](${absoluteUrl(url)})`,
      `**Source:** \`${source}\``,
      '',
      '### What is wrong or missing?',
      '',
      '',
      '### What did you expect?',
      '',
      '',
    ].join('\n'),
  );

  const editUrl = `https://github.com/${owner}/${name}/blob/${branch}/${source}`;

  return (
    <div className="not-prose mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-fd-border pt-6 text-sm">
      <span className="text-fd-muted-foreground">Something wrong on this page?</span>
      <a
        href={issueUrl.toString()}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-fd-primary hover:underline"
      >
        Report an issue
      </a>
      <span aria-hidden className="text-fd-muted-foreground/50">
        ·
      </span>
      <a
        href={editUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-fd-muted-foreground hover:text-fd-foreground hover:underline"
      >
        Edit this page
      </a>
    </div>
  );
}
