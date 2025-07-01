import { docs, blog } from '@/.source';
import { loader } from 'fumadocs-core/source';

// See https://fumadocs.vercel.app/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

// Create blog source loader
export const blogSource = loader({
  baseUrl: '/blog',
  source: blog.toFumadocsSource(),
});

// Export blog source for use in blog pages
export { blogSource as blog };
