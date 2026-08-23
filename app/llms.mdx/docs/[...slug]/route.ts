import { source } from '@/lib/source';
import { getLLMText } from '@/lib/get-llm-text';
import { notFound } from 'next/navigation';

/**
 * Raw-markdown mirror of every docs page.
 *
 * Under `output: 'export'` these are written to disk, then remapped by
 * scripts/emit-agent-assets.mts to `out/docs/**.md` so that `<any-docs-route>.md`
 * resolves as a real static file on any host.
 *
 * Every route ends in a literal `_md` segment. Without it, a section index page
 * (`/docs/data`) and its children (`/docs/data/querying`) would need the same
 * path to be both a file and a directory, which fails on export. Terminating
 * every route with `_md` guarantees the emitted paths are always leaf files.
 */
export const dynamic = 'force-static';
export const revalidate = false;

const TERMINAL = '_md';

export async function GET(
  _req: Request,
  { params }: RouteContext<'/llms.mdx/docs/[...slug]'>,
) {
  const { slug } = await params;
  if (slug.at(-1) !== TERMINAL) notFound();

  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return new Response(await getLLMText(page), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return source.generateParams().map(({ slug }) => ({
    slug: [...(slug ?? []), TERMINAL],
  }));
}
