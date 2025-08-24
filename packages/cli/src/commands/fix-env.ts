import { isCancel, log, text } from '@clack/prompts';
import { getProjectRoot, parseEnv } from '../utils';
import { readFile, writeFile } from 'fs/promises';
import type { Command } from '.';
import { join } from 'path';

const requiredManualVariables = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
];

export const command: Command = {
  id: 'env',
  description: 'Setup/Fix your environment variables',
  run: async () => {
    const root = await getProjectRoot();
    const envFile = await readFile(join(root, '.env'), 'utf8').catch(() => null);
    const exampleEnv = await readFile(join(root, '.env.example'), 'utf8').catch(() => null);
    let envVariables = parseEnv(envFile ?? '');
    if (!exampleEnv) {
      log.error("No .env.example file found, can't continue");
      process.exit(0);
    }

    const exampleEnvVariables = parseEnv(exampleEnv);
    if (!envFile) {
      log.step('No .env file exists, creating one');
    } else {
      if (envVariables.some((v) => v.key.startsWith('NEXT_PUBLIC_'))) {
        log.step('Found old variables, migrating them to the new format');
        envVariables = envVariables.map((v) => {
          if (v.key.startsWith('NEXT_PUBLIC_')) {
            return { key: v.key.replace('NEXT_PUBLIC_', 'VITE_PUBLIC_'), value: v.value };
          }
          return v;
        });
      }
    }

    for (const key of requiredManualVariables) {
      const currentValue = envVariables.find((v) => v.key === key)?.value || '';
      const newValue = await text({
        message: `Enter value for ${key}`,
        initialValue: currentValue,
        validate: (value) => (value.length > 0 ? undefined : 'Value is required'),
      });

      if (isCancel(newValue)) {
        log.error('Cancelled');
        process.exit(0);
      }

      envVariables.push({ key, value: newValue });
    }

    const missingVariables = exampleEnvVariables.filter(
      (v) => !envVariables.find((v2) => v2.key === v.key),
    );
    if (missingVariables.length > 0) {
      log.step('Missing variables in current .env file:');
      for (const v of missingVariables) {
        log.message(`${v.key}=${v.value}`);
      }
    }

    for (const v of missingVariables) {
      const newValue = await text({
        message: `Enter value for ${v.key}`,
        initialValue: v.value ?? '',
        defaultValue: ' ',
      });

      if (isCancel(newValue)) {
        log.error('Cancelled');
        process.exit(0);
      }

      envVariables.push({ key: v.key, value: newValue });
    }

    const env = envVariables.reduce(
      (acc, { key, value }) => {
        acc[key] = value?.trim() ?? '';
        return acc;
      },
      {} as Record<string, string>,
    );

    await writeFile(
      join(root, '.env'),
      Object.entries(env)
        .map(([key, value]) => `${key}="${value}"`)
        .join('\n'),
    );
  },
};
