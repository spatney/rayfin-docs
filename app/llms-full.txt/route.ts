import { renderFullCorpus } from '@/lib/llms-bundles';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  return new Response(await renderFullCorpus(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
