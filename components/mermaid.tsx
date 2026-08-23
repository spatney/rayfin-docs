'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

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
        const { svg } = await mermaid.render(`mermaid-${id}`, chart.trim());
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
