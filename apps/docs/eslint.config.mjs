// apps/docs/eslint.config.mjs

import base from '@zero/eslint-config';

export default [
  ...base,
  {
    // docs-specific ESLint rules here
    rules: {
      // e.g. 'mdx/no-unused-expressions': 'error',
    },
  },
];
