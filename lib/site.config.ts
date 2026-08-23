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
  baseUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://purple-grass-01682270f.7.azurestaticapps.net').replace(/\/$/, ''),
  repo: 'https://github.com/microsoft/rayfin',

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
