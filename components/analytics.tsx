/**
 * Microsoft Clarity, for human pageviews.
 *
 * Deliberately a plain inline <script> in <head> rather than next/script. Clarity's tag
 * file assumes a `window.clarity` queue stub already exists — it calls it immediately and
 * throws `a[c] is not a function` if it doesn't. next/script defers inline content to
 * hydration and only ships it inside the RSC payload, which lost that race. A real script
 * tag executes in document order, so the stub is always defined before the async tag runs.
 *
 * Agents fetch the `.md` mirrors, `llms.txt` and `AGENTS.md` — static text that never
 * executes JavaScript — so this measures the human half only. Total traffic across both
 * audiences comes from the Azure `SiteHits` metric; see `npm run analytics`.
 *
 * Renders nothing unless NEXT_PUBLIC_CLARITY_PROJECT_ID is set, so forks, preview builds
 * and local development stay untracked.
 */
export function Analytics() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!projectId) return null;

  // Clarity's official snippet; `i` is the project id.
  const snippet = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(projectId)});`;

  return (
    <>
      <link rel="preconnect" href="https://www.clarity.ms" />
      <script dangerouslySetInnerHTML={{ __html: snippet }} />
    </>
  );
}
