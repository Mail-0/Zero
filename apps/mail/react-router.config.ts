import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  buildDirectory: 'build',
  future: {
    unstable_viteEnvironmentApi: true,
  },
} satisfies Config;
