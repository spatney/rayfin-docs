import { ImageResponse } from 'next/og';
import { siteConfig } from '@/lib/site.config';

/**
 * Shared 1200x630 card used by both the home page and every docs page.
 *
 * Rendered at build time — `output: 'export'` prerenders image routes the same way
 * it prerenders pages, so these ship as plain PNGs with no runtime. Deliberately
 * font-free: `ImageResponse` falls back to its bundled face, and fetching a webfont
 * here would make the build depend on the network.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

export function renderOgImage({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0f14',
          backgroundImage:
            'radial-gradient(ellipse 50% 70% at 50% 0%, rgba(45, 212, 191, 0.18), transparent)',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              backgroundColor: '#2dd4bf',
            }}
          />
          <div
            style={{
              fontSize: 26,
              color: '#5eead4',
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow ?? siteConfig.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: title.length > 42 ? 62 : 76,
              fontWeight: 700,
              color: '#f8fafc',
              lineHeight: 1.1,
              letterSpacing: -1.5,
            }}
          >
            {title}
          </div>
          {description ? (
            <div
              style={{
                marginTop: 24,
                fontSize: 30,
                color: '#94a3b8',
                lineHeight: 1.35,
              }}
            >
              {truncate(description, 140)}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: '#64748b',
          }}
        >
          <div>rayfin.ai</div>
          <div>TypeScript backends on Microsoft Fabric</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}
