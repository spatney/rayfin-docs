import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { PromptCard } from '@/components/prompt-card';

const DefaultPre = defaultMdxComponents.pre;

/**
 * Upgrade ```prompt fences into prompt cards.
 *
 * `addLanguageClass` (see source.config.ts) puts `language-prompt` on the inner
 * <code> element, which is the only marker available after Shiki has run. Every
 * other fence falls through to the standard Fumadocs code block.
 */
function Pre(props: ComponentProps<'pre'> & { title?: string }) {
  if (isPromptFence(props.children)) {
    return <PromptCard title={props.title}>{props.children}</PromptCard>;
  }
  return DefaultPre ? <DefaultPre {...props} /> : <pre {...props} />;
}

function isPromptFence(children: ReactNode): boolean {
  if (!isValidElement<{ className?: string }>(children)) return false;
  return children.props.className?.split(/\s+/).includes('language-prompt') ?? false;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    pre: Pre,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
