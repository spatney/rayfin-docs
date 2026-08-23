import type { Root, Element, ElementContent } from 'hast';
import type { Transformer } from 'unified';

/**
 * Render GitHub alert blockquotes (`> [!NOTE]`) as Fumadocs callouts.
 *
 * This runs at the **rehype** stage on purpose. `includeProcessedMarkdown` (see
 * source.config.ts) stringifies the MDAST at the remark stage, so transforming
 * alerts here leaves the Markdown mirrors with their original `> [!NOTE]` syntax
 * while the rendered page gets a real callout. Doing it as a remark plugin would
 * replace the blockquote in the mirrors too.
 */

const ALERT = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

/** GitHub alert kinds mapped onto Fumadocs `CalloutType`. */
const TYPES: Record<string, { type: string; title: string }> = {
  NOTE: { type: 'info', title: 'Note' },
  TIP: { type: 'idea', title: 'Tip' },
  IMPORTANT: { type: 'info', title: 'Important' },
  WARNING: { type: 'warn', title: 'Warning' },
  CAUTION: { type: 'error', title: 'Caution' },
};

export function rehypeGithubAlerts(): Transformer<Root, Root> {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (
        node.type !== 'element' ||
        node.tagName !== 'blockquote' ||
        !parent ||
        index === undefined
      ) {
        return;
      }

      const kind = takeAlertMarker(node);
      if (!kind) return;

      const { type, title } = TYPES[kind];

      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'Callout',
        attributes: [
          { type: 'mdxJsxAttribute', name: 'type', value: type },
          { type: 'mdxJsxAttribute', name: 'title', value: title },
        ],
        children: node.children,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MDX node in a hast tree
      } as any;
    });
  };
}

/**
 * If the blockquote opens with an alert marker, strip the marker in place and
 * return its kind. Returns undefined for ordinary blockquotes.
 */
function takeAlertMarker(blockquote: Element): string | undefined {
  const paragraph = blockquote.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'p',
  );
  if (!paragraph) return undefined;

  const first = paragraph.children[0];
  if (!first || first.type !== 'text') return undefined;

  const match = ALERT.exec(first.value);
  if (!match) return undefined;

  first.value = first.value.slice(match[0].length).replace(/^\n/, '');

  // A marker on its own line leaves an empty text node and a stray <br>.
  if (first.value === '') {
    paragraph.children.shift();
    const next = paragraph.children[0];
    if (next && next.type === 'element' && next.tagName === 'br') {
      paragraph.children.shift();
    }
  }

  return match[1];
}

/** Minimal depth-first walk; avoids pulling in unist-util-visit for one use. */
function visit(
  node: Root | ElementContent,
  fn: (node: ElementContent, index?: number, parent?: Root | Element) => void,
) {
  const children = 'children' in node ? node.children : undefined;
  if (!children) return;

  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i] as ElementContent;
    visit(child, fn);
    fn(child, i, node as Root | Element);
  }
}
