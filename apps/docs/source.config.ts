import {
  defineConfig,
  defineDocs,
  defineCollections,
  frontmatterSchema,
  metaSchema,
} from 'fumadocs-mdx/config';
import { rehypeCode } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

// Blog collection with additional fields
export const blog = defineDocs({
  dir: './content/blog',
  docs: {
    schema: frontmatterSchema.extend({
      author: z.string().optional(),
      date: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  },
});

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: [
      [rehypeCode, {
        // Optional: Configure themes
        themes: {
          light: 'github-light',
          dark: 'github-dark',
        },
        // Optional: Configure languages (defaults include common ones)
        langs: ['javascript', 'typescript', 'jsx', 'tsx', 'json', 'bash', 'shell', 'python', 'perl', 'ini', 'yaml', 'markdown'],
        // Optional: Enable inline code highlighting
        inline: 'tailing-curly-colon',
      }],
    ],
  },
});
