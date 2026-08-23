import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  // Fully static, host-agnostic output — but only for real builds. Under `next dev`,
  // `output: 'export'` also enforces generateStaticParams membership on route handlers,
  // which blocks the dev-only `.md` rewrites below.
  output: process.env.NODE_ENV === 'development' ? undefined : 'export',
  trailingSlash: false,

  images: { unoptimized: true },

  typescript: { ignoreBuildErrors: false },

  /**
   * `rewrites()` is ignored under `output: 'export'`, so in production the `<route>.md`
   * mirrors are emitted as real static files by scripts/emit-agent-assets.mts.
   * `next dev` does not run that script, so without these rewrites every `.md` URL 404s
   * during local development. Dev-only, to keep the two paths from diverging silently.
   *
   * Note that `:path*` captures the `.md` suffix as part of the final segment; the route
   * handler strips it.
   */
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];

    return [
      { source: '/docs.md', destination: '/llms.mdx/docs/_md' },
      { source: '/docs/:path*.md', destination: '/llms.mdx/docs/:path*/_md' },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
