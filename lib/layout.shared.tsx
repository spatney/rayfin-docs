import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { siteConfig } from '@/lib/site.config';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <span
            aria-hidden
            className="inline-block size-5 rounded-[6px] bg-gradient-to-br from-sky-400 to-indigo-600"
          />
          <span className="font-semibold">{siteConfig.name}</span>
        </>
      ),
    },
    githubUrl: siteConfig.repo,
  };
}
