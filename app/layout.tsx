import './global.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { siteConfig } from '@/lib/site.config';
import { Analytics } from '@/components/analytics';
import { OG_HOME_PATH } from '@/app/og.png/route';

const inter = Inter({ subsets: ['latin'] });

const ogAlt = `${siteConfig.name} — ${siteConfig.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.baseUrl),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    siteName: siteConfig.name,
    type: 'website',
    images: [{ url: OG_HOME_PATH, width: 1200, height: 630, alt: ogAlt }],
  },
  // The og routes emit 1200x630 cards, which only render at full width if the card
  // type is upgraded from the default `summary`.
  twitter: {
    card: 'summary_large_image',
    images: [{ url: OG_HOME_PATH, alt: ogAlt }],
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <head>
        {/* Advertise the machine-readable mirrors to crawling agents. */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="llms-full.txt" />
        <Analytics />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          search={{
            // Search indexes are prebuilt and queried in the browser, which is
            // what makes `output: 'export'` viable.
            options: { type: 'static' },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
