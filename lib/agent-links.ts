/**
 * Deep links that hand a prompt to a coding agent.
 * Shared by the landing page and the in-page prompt cards so the set stays consistent.
 *
 * Every prompt in these docs asks an agent to run `npm create`, `rayfin login` and
 * `rayfin up`, so the target has to be an agent with a terminal it can actually install
 * and run things in. Browser chat surfaces can only print the steps back at you, which
 * is why the only link here is the GitHub Copilot desktop app.
 *
 * The app is reached through GitHub's hosted launcher, which hands off to the `ghapp://`
 * protocol when the app is installed and falls back to a web page when it is not. The
 * launcher takes the whole app link encoded in `open`, so the prompt is encoded twice —
 * once as a query parameter of the app link, once as part of `open`.
 * https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links
 */
export function copilotAppUrl(prompt: string): string {
  const appLink = `ghapp://session/new?prompt=${encodeURIComponent(prompt)}`;
  return `https://github.com/copilot/app/launch?open=${encodeURIComponent(appLink)}`;
}

export const AGENT_LINKS = [
  {
    id: 'copilot-app',
    label: 'Copilot app',
    href: copilotAppUrl,
  },
] as const;
