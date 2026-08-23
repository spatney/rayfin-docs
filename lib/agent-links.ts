/**
 * Link to the GitHub Copilot desktop app, shared by the landing page and the in-page
 * prompt cards so both surfaces behave identically.
 *
 * Every prompt in these docs asks an agent to run `npm create`, `rayfin login` and
 * `rayfin up`, so the target has to be an agent with a terminal it can actually install
 * and run things in. Browser chat surfaces can only print the steps back at you, which
 * is why the desktop app is the only destination offered.
 *
 * The prompt travels by clipboard rather than in the URL. `ghapp://session/new` does
 * accept a `prompt` parameter, but it also requires `repo`, and we cannot know which
 * repository the reader is working in — without it the app refuses the link with
 * "Missing required 'repo' parameter". No other documented app link carries a prompt,
 * so the buttons copy first and open Chats second.
 * https://docs.github.com/en/copilot/how-tos/github-copilot-app/open-with-deep-links
 */
const APP_LINK = 'ghapp://chats';

/**
 * GitHub's hosted launcher, which hands off to the `ghapp://` protocol when the app is
 * installed and shows a fallback page when it is not.
 */
export const COPILOT_APP_URL = `https://github.com/copilot/app/launch?open=${encodeURIComponent(
  APP_LINK,
)}`;

export const COPILOT_APP_LABEL = 'Copilot app';

/** Title text explaining that the button copies the prompt before opening the app. */
export const COPILOT_APP_HINT =
  'Copies the prompt and opens the GitHub Copilot app — paste it into a new chat';
