import { defineConfig, defineDocs, frontmatterSchema } from 'fumadocs-mdx/config';
import { rehypeCodeDefaultOptions } from 'fumadocs-core/mdx-plugins';
import { rehypeGithubAlerts } from './lib/rehype-github-alerts';
import type { LanguageRegistration } from 'shiki';
import { z } from 'zod';

/**
 * `prompt` is an authoring primitive, not a real language: prompt bodies are prose,
 * so the grammar deliberately has no highlighting rules. Registering it as a real
 * Shiki language (rather than aliasing it) is what makes `addLanguageClass` emit
 * `language-prompt`, which the renderer uses to upgrade the fence into a prompt
 * card. The fence itself is untouched in the .md mirrors.
 */
const promptLanguage: LanguageRegistration = {
  name: 'prompt',
  scopeName: 'source.prompt',
  patterns: [],
  repository: {},
};

/**
 * Frontmatter contract for every docs page.
 *
 * `description` is not marked required here so that authoring never hard-fails the
 * build; `scripts/check-docs.mts` enforces it as a lint error instead.
 */
const docsFrontmatter = frontmatterSchema.extend({
  /** Short summary. Powers <meta name="description">, llms.txt and search. */
  description: z.string().optional(),
  /** Free-form keywords used by search ranking and the prompt library. */
  tags: z.array(z.string()).optional(),
  /** Rayfin SDK/CLI versions the page was written against. */
  appliesTo: z.string().optional(),
});

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: docsFrontmatter,
    // Required for the .md mirrors, /llms.txt and /llms-full.txt.
    postprocess: {
      includeProcessedMarkdown: {
        headingIds: true,
        // Interactive-only components collapse to a readable placeholder in
        // markdown output rather than disappearing silently.
        mdxAsPlaceholder: ['Mermaid'],
      },
    },
  },
});

export default defineConfig({
  mdxOptions: {
    remarkNpmOptions: { persist: { id: 'package-manager' } },
    rehypeCodeOptions: {
      ...rehypeCodeDefaultOptions,
      themes: { light: 'github-light', dark: 'github-dark' },
      langs: [promptLanguage],
      addLanguageClass: true,
    },
    // Appended so it runs after the markdown mirrors have been stringified.
    rehypePlugins: (plugins) => [...plugins, rehypeGithubAlerts],
  },
});
