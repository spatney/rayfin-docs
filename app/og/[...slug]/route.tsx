import { notFound } from 'next/navigation';
import { source } from '@/lib/source';
import { renderOgImage } from '@/lib/og-image';

/**
 * Social cards for every docs page.
 *
 * This is a route handler rather than an `opengraph-image` metadata file because
 * Next rejects metadata images under an optional catch-all, which is what
 * app/docs/[[...slug]] is. Pages therefore link their card explicitly — see
 * `ogImageUrl` below, used from generateMetadata.
 *
 * Every route ends in a literal `og.png` segment so that the exported file lands
 * with a real extension (`out/og/data/querying/og.png`) and static hosts serve it
 * as an image without any per-host MIME configuration.
 */
export const dynamic = 'force-static';
export const revalidate = false;

const TERMINAL = 'og.png';

/** Path of the social card for a docs page URL, e.g. `/docs/data` -> `/og/data/og.png`. */
export function ogImagePath(slugs: string[]): string {
  return `/og/${[...slugs, TERMINAL].join('/')}`;
}

export async function GET(_req: Request, { params }: RouteContext<'/og/[...slug]'>) {
  const { slug } = await params;
  if (slug.at(-1) !== TERMINAL) notFound();

  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  const section = page.slugs.length > 1 ? source.getPage([page.slugs[0]]) : undefined;

  return renderOgImage({
    title: page.data.title ?? 'Rayfin documentation',
    description: page.data.description,
    eyebrow: section?.data.title ? `Rayfin · ${section.data.title}` : 'Rayfin docs',
  });
}

export function generateStaticParams() {
  return source.generateParams().map(({ slug }) => ({
    slug: [...(slug ?? []), TERMINAL],
  }));
}
