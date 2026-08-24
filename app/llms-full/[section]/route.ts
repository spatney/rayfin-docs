import { getBundles, renderBundle } from '@/lib/llms-bundles';
import { notFound } from 'next/navigation';

/**
 * Per-section slices of `/llms-full.txt`.
 *
 * Emitted without an extension (`out/llms-full/data`) because the route segment is
 * the section slug; scripts/emit-agent-assets.mts renames each to `<section>.txt`,
 * which is the path advertised in llms.txt and AGENTS.md.
 */
export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: RouteContext<'/llms-full/[section]'>,
) {
  const { section } = await params;

  const bundle = getBundles().find((b) => b.section === section);
  if (!bundle) notFound();

  return new Response(await renderBundle(bundle), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export function generateStaticParams() {
  return getBundles().map(({ section }) => ({ section }));
}
