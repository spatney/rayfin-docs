import { renderOgImage } from '@/lib/og-image';
import { siteConfig } from '@/lib/site.config';

/**
 * Social card for the home page.
 *
 * A route handler in a literal `og.png` directory rather than the `opengraph-image`
 * metadata convention: that convention exports an extensionless file, which static
 * hosts serve as application/octet-stream, and neither a MIME map nor a route header
 * can override the content type Azure Static Web Apps derives from the stored blob.
 * A real `.png` path needs no host configuration at all.
 */
export const dynamic = 'force-static';
export const revalidate = false;

export const OG_HOME_PATH = '/og.png';

export function GET() {
  return renderOgImage({
    title: siteConfig.tagline,
    description: siteConfig.description,
  });
}
