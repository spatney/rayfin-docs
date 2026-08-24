'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

type Swatch = { fill: string; stroke: string; text: string; dashed?: boolean };

/**
 * Semantic node classes every flowchart can use.
 *
 * Diagrams say `class Fn,Blob experimental` rather than carrying hex colours, so one
 * fence renders correctly in both themes and the class name still communicates intent
 * when the page is read as raw Markdown.
 */
const NODE_CLASSES: Record<'dark' | 'light', Record<string, Swatch>> = {
  dark: {
    actor: { fill: '#16232b', stroke: '#4d7286', text: '#dbe7ee' },
    service: { fill: '#132a2a', stroke: '#2f6f6a', text: '#e8f3f1' },
    store: { fill: '#101f2b', stroke: '#3a6a8f', text: '#dbe9f3' },
    external: { fill: '#1d1b26', stroke: '#5b5470', text: '#e2dff0', dashed: true },
    experimental: { fill: '#241f16', stroke: '#8a6d38', text: '#f2e7d3', dashed: true },
  },
  light: {
    actor: { fill: '#eef4f8', stroke: '#7fa3b8', text: '#12303d' },
    service: { fill: '#eefaf7', stroke: '#8fd3c6', text: '#0d2b28' },
    store: { fill: '#eaf3fb', stroke: '#8bb6d9', text: '#0f2a3d' },
    external: { fill: '#f3f1fa', stroke: '#a79ec8', text: '#251f3d', dashed: true },
    experimental: { fill: '#fdf6e8', stroke: '#c9a45c', text: '#3d2f12', dashed: true },
  },
};

/**
 * Insert the class definitions directly after the diagram's header line.
 *
 * They go after the header because `flowchart TB` must come first, and before the body
 * so that every `class` statement refers to an already-defined name. Only flowcharts
 * understand `classDef`, so other diagram types are passed through untouched.
 */
function withNodeClasses(source: string, dark: boolean): string {
  const breakAt = source.indexOf('\n');
  if (breakAt === -1) return source;

  const header = source.slice(0, breakAt);
  if (!/^\s*(flowchart|graph)\b/.test(header)) return source;

  const defs = Object.entries(NODE_CLASSES[dark ? 'dark' : 'light'])
    .map(
      ([name, s]) =>
        `  classDef ${name} fill:${s.fill},stroke:${s.stroke},color:${s.text},stroke-width:1.5px` +
        (s.dashed ? ',stroke-dasharray:4 3' : ''),
    )
    .join('\n');

  return `${header}\n${defs}\n${source.slice(breakAt + 1)}`;
}

/**
 * Renders a ```mermaid fence as a diagram.
 *
 * The chart source is passed as a string rather than read from the DOM: Fumadocs'
 * code blocks lay each line out as a flex item, so `textContent` would concatenate
 * lines without newlines and mermaid would fail to parse.
 */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mermaid = (await import('mermaid')).default;
      const dark = resolvedTheme === 'dark';

      // `base` + explicit variables, because the stock themes render subgraphs as a
      // flat grey slab that reads poorly against the site's surfaces.
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        fontFamily: 'inherit',
        theme: 'base',
        themeVariables: {
          background: 'transparent',
          primaryColor: dark ? '#132a2a' : '#eefaf7',
          primaryBorderColor: dark ? '#2f6f6a' : '#8fd3c6',
          primaryTextColor: dark ? '#e8f3f1' : '#0d2b28',
          lineColor: dark ? '#6b8f8b' : '#5b8f86',
          textColor: dark ? '#d5e3e1' : '#1d3a37',
          clusterBkg: dark ? '#0f1c1c' : '#f6fbfa',
          clusterBorder: dark ? '#2a4442' : '#cfe7e2',
          nodeBorder: dark ? '#2f6f6a' : '#8fd3c6',
          edgeLabelBackground: dark ? '#0f1c1c' : '#f6fbfa',
          fontSize: '14px',
        },
      });

      try {
        const { svg } = await mermaid.render(
          `mermaid-${id}`,
          withNodeClasses(chart.trim(), dark),
        );
        if (!cancelled) {
          setSvg(svg);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (error) {
    // Fall back to the source rather than showing nothing.
    return (
      <figure className="not-prose my-5 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        <figcaption className="border-b border-fd-border bg-fd-secondary/60 px-3 py-2 text-xs text-fd-muted-foreground">
          Diagram could not be rendered: {error}
        </figcaption>
        <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px]">{chart}</pre>
      </figure>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      className="not-prose my-5 flex justify-center overflow-x-auto rounded-xl border border-fd-border bg-fd-card p-5 [&_svg]:max-w-full"
      // eslint-disable-next-line react/no-danger -- mermaid output, securityLevel: 'strict'
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
