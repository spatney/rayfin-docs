import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

/**
 * Static export: the index is serialized at build time and queried in the
 * browser. `staticGET` is what makes search work without a server.
 */
export const { staticGET: GET } = createFromSource(source, {
  language: 'english',
});

export const dynamic = 'force-static';
export const revalidate = false;
