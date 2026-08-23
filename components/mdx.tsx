import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { PromptCard } from '@/components/prompt-card';
import { Mermaid } from '@/components/mermaid';

const DefaultPre = defaultMdxComponents.pre;

/**
 * Upgrade fences that are authoring primitives rather than real code.
 *
 * `addLanguageClass` (see source.config.ts) puts `language-<lang>` on the inner <code>
 * element, which is the only marker left after Shiki has run. Both `prompt` and
 * `mermaid` stay untouched as fences in the `.md` mirrors — only presentation changes.
 */
function Pre(props: ComponentProps<'pre'> & { title?: string }) {
  const lang = fenceLanguage(props.children);

  if (lang === 'prompt') {
    return <PromptCard title={props.title}>{props.children}</PromptCard>;
  }

  if (lang === 'mermaid') {
    return <Mermaid chart={extractCode(props.children)} />;
  }

  return DefaultPre ? <DefaultPre {...props} /> : <pre {...props} />;
}

function fenceLanguage(children: ReactNode): string | undefined {
  if (!isValidElement<{ className?: string }>(children)) return undefined;
  return children.props.className
    ?.split(/\s+/)
    .find((c) => c.startsWith('language-'))
    ?.slice('language-'.length);
}

/**
 * Recover the original source text from Shiki's highlighted tree.
 *
 * Shiki wraps each source line in a `.line` element. Those are collected individually
 * and re-joined, because Fumadocs lays them out as flex items and the tree also carries
 * its own newline text nodes — naively concatenating everything doubles the line breaks.
 */
function extractCode(node: ReactNode): string {
  const lines: string[] = [];
  let sawLine = false;
  let buffer = '';

  const text = (current: ReactNode): string => {
    if (current === null || current === undefined || typeof current === 'boolean') return '';
    if (typeof current === 'string' || typeof current === 'number') return String(current);
    if (Array.isArray(current)) return current.map(text).join('');
    if (isValidElement<{ children?: ReactNode }>(current)) return text(current.props.children);
    return '';
  };

  const walk = (current: ReactNode) => {
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }

    if (isValidElement<{ children?: ReactNode; className?: string }>(current)) {
      if (current.props.className?.split(/\s+/).includes('line')) {
        sawLine = true;
        lines.push(text(current.props.children).replace(/\n+$/, ''));
        return;
      }
      walk(current.props.children);
      return;
    }

    buffer += text(current);
  };

  walk(node);
  return (sawLine ? lines.join('\n') : buffer).trim();
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    pre: Pre,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
