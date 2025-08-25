import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  buildDirectory: 'build',
  appDirectory: 'app',
  routeDiscovery: {
    mode: 'lazy',
  },
  prerender: ['/manifest.webmanifest'],
  future: {
    unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
