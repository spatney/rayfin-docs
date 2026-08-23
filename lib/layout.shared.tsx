import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { siteConfig } from '@/lib/site.config';
import logo from '@/public/rayfin-logo.png';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src={logo}
            alt=""
            aria-hidden
            width={24}
            height={24}
            className="size-6"
            priority
          />
          <span className="font-semibold">{siteConfig.name}</span>
        </>
      ),
    },
    githubUrl: siteConfig.repo,
  };
}
