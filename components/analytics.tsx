import Script from 'next/script';

/**
 * Microsoft Clarity, for human pageviews.
 *
 * Agents fetch the `.md` mirrors, `llms.txt` and `AGENTS.md` — static text that never
 * executes JavaScript — so this deliberately measures the human half only. Total traffic
 * across both audiences comes from the Azure `SiteHits` metric; see `npm run analytics`.
 *
 * Renders nothing unless NEXT_PUBLIC_CLARITY_PROJECT_ID is set, so local builds and forks
 * stay untracked.
 */
export function Analytics() {
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  if (!projectId) return null;

  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${JSON.stringify(projectId)});`}
    </Script>
  );
}
