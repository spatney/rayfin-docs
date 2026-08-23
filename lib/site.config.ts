/**
 * Single source of truth for site-wide constants.
 *
 * `baseUrl` is used to build absolute canonical links inside the generated `.md`
 * mirrors, `llms.txt` and `sitemap.xml`. Override at build time with
 * `NEXT_PUBLIC_SITE_URL` when publishing to a real domain.
 */
export const siteConfig = {
  name: 'Rayfin',
  tagline: 'Agent-first apps for the enterprise.',
  description:
    'Rayfin is a backend platform built for the agentic era. Define your data model in TypeScript and get a database, APIs, type-safe clients, auth, and hosting — deployed and managed on Microsoft Fabric.',
  baseUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rayfin.ai').replace(/\/$/, ''),
  repo: 'https://github.com/spatney/rayfin-docs',

  /** Used to build "edit this page" and "report an issue" links. */
  github: {
    owner: 'spatney',
    name: 'rayfin-docs',
    branch: 'master',
    /** Directory holding the MDX sources, relative to the repo root. */
    contentDir: 'content/docs',
  },

  /** Rayfin package versions this documentation set was written against. */
  sdkVersion: '1.34.0',
  cliVersion: '1.33.2',

  /** npm package names documented by the SDK reference section. */
  packages: [
    '@microsoft/rayfin-core',
    '@microsoft/rayfin-client',
    '@microsoft/rayfin-data',
    '@microsoft/rayfin-auth',
    '@microsoft/rayfin-auth-provider-fabric',
    '@microsoft/rayfin-functions',
    '@microsoft/rayfin-storage',
    '@microsoft/rayfin-lib',
    '@microsoft/rayfin-cli',
  ],
} as const;

export function absoluteUrl(path: string): string {
  return `${siteConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
