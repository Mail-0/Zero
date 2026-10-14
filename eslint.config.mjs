import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { default: config } = await jiti.import('./packages/eslint-config/config.ts');

export default config;
