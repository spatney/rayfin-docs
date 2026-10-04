import { isValidElement, type ComponentProps, type ComponentType, type ReactNode } from 'react';

/**
 * Version and status tags are authored as plain Markdown links into the changelog:
 *
 *   [New in 1.36](/docs/reference/changelog#rayfin-136)
 *   [Preview](/docs/reference/changelog#feature-status)
 *
 * That keeps them meaningful in the `.md` mirrors (an agent sees the label and can
 * follow the link to the release notes) and lets `check:docs` validate every anchor.
 * Only the rendered page upgrades them into pills. Any other link renders unchanged.
 */
export const CHANGELOG_PATH = '/docs/reference/changelog';

export const VERSION_TAG = /^(New|Changed|Deprecated|Removed) in (\d+\.\d+(?:\.\d+)?)$/;
export const STATUS_TAG = /^(Preview|Experimental)$/;

const TONES: Record<string, string> = {
  New: 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300',
  Changed:
    'border-amber-600/30 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-300',
  Deprecated: 'border-red-600/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:text-red-300',
  Removed: 'border-red-600/30 bg-red-500/10 text-red-700 dark:border-red-400/30 dark:text-red-300',
  Preview:
    'border-violet-600/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:text-violet-300',
  Experimental:
    'border-violet-600/30 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:text-violet-300',
};

const BASE =
  'not-prose mx-0.5 inline-flex items-center whitespace-nowrap rounded-full border px-2 py-px align-[0.1em] text-[0.7rem] leading-4 font-medium no-underline transition-opacity hover:opacity-80';

type AnchorProps = ComponentProps<'a'>;

/** Wrap the page's link component so changelog tags render as badges. */
export function withVersionBadges(Link: ComponentType<AnchorProps>) {
  function VersionAwareLink(props: AnchorProps) {
    const kind = badgeKind(props.href, props.children);
    if (!kind) return <Link {...props} />;

    return (
      <Link
        {...props}
        className={`${BASE} ${TONES[kind]}`}
        title={kind === 'Preview' || kind === 'Experimental' ? 'Feature status' : 'Release notes'}
      />
    );
  }

  return VersionAwareLink;
}

function badgeKind(href: string | undefined, children: ReactNode): string | undefined {
  if (!href || !href.startsWith(`${CHANGELOG_PATH}#`)) return undefined;

  const label = textOf(children).trim();
  return VERSION_TAG.exec(label)?.[1] ?? STATUS_TAG.exec(label)?.[1];
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}
