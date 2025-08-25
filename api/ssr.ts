export const config = { runtime: 'edge' } as const;

// Re-export the Workers-style fetch handler emitted by the SSR build
// Path is from repo root to the built server bundle
export { fetch } from '../apps/mail/build/server/index.js';
