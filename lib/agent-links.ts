/**
 * Deep links that hand a prompt to a coding assistant.
 * Shared by the landing page and the in-page prompt cards so the set stays consistent.
 */
export const AGENT_LINKS = [
  {
    id: 'copilot',
    label: 'Copilot',
    href: (prompt: string) =>
      `https://github.com/copilot?prompt=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    href: (prompt: string) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: 'claude',
    label: 'Claude',
    href: (prompt: string) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
] as const;
