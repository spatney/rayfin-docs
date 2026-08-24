import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og-image';
import { siteConfig } from '@/lib/site.config';

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Metadata image routes are treated as dynamic by default, which `output: 'export'`
// rejects outright.
export const dynamic = 'force-static';
export const revalidate = false;

export default function Image() {
  return renderOgImage({
    title: siteConfig.tagline,
    description: siteConfig.description,
  });
}
