import { createMDX } from 'fumadocs-mdx/next';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,

  // Fully static, host-agnostic output. Note: `rewrites()` does NOT run under
  // `output: 'export'`, which is why the `.md` mirrors are emitted as real files
  // by scripts/emit-agent-assets.mts instead of via a rewrite.
  output: 'export',
  trailingSlash: false,

  images: { unoptimized: true },

  typescript: { ignoreBuildErrors: false },
};

const withMDX = createMDX();

export default withMDX(config);
