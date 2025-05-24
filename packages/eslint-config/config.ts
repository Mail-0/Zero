import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.react-router/**',
    '**/.well-known/**',
  ]),
  // @ts-expect-error
  tseslint.configs.recommended,
  reactHooksPlugin.configs['recommended-latest'],
]);
