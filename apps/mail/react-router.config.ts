import type { Config } from '@react-router/dev/config';

export default {
  ssr: false,
  buildDirectory: 'build',
  prerender: ['/og-api/home', '/og-api/create', '/manifest.webmanifest'],
  future: {
    unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
