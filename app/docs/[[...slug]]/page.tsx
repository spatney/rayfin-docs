import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { getMDXComponents } from '@/components/mdx';
import { PageFeedback } from '@/components/page-feedback';
import { absoluteUrl, siteConfig } from '@/lib/site.config';
import { ogImagePath } from '@/app/og/[...slug]/route';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
        <PageFeedback
          title={page.data.title ?? 'Rayfin docs'}
          url={page.url}
          path={page.path}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(
  props: PageProps<'/docs/[[...slug]]'>,
): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const title = page.data.title ?? siteConfig.name;
  const description = page.data.description ?? siteConfig.description;
  const image = absoluteUrl(ogImagePath(page.slugs));

  return {
    title,
    description,
    alternates: {
      canonical: absoluteUrl(page.url),
      types: {
        'text/markdown': absoluteUrl(`${page.url}.md`),
      },
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(page.url),
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
