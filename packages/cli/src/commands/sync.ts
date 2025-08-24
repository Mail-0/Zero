import { getProjectRoot, runCommand } from '../utils';
import { cp, readFile } from 'fs/promises';
import { log } from '@clack/prompts';
import type { Command } from '.';
import { join } from 'path';

export const command: Command = {
  id: 'sync',
  description: 'Sync your environment variables and types',
  run: async () => {
    const root = await getProjectRoot();
    const envFile = await readFile(join(root, '.env'), 'utf8').catch(() => null);

    if (!envFile) {
      log.step('No .env file exists, creating one using `pnpm nizzy env`');
      process.exit(0);
    }

    log.step('Syncing environment variables');
    cp(join(root, '.env'), join(root, 'apps/mail/.dev.vars'));
    cp(join(root, '.env'), join(root, 'apps/mail/.env'));
    cp(join(root, '.env'), join(root, 'apps/server/.dev.vars'));

    log.step('Syncing frontend types');
    await runCommand('pnpm', ['run', 'types'], { cwd: join(root, 'apps/mail') });
    log.step('Syncing backend types');
    await runCommand('pnpm', ['run', 'types'], { cwd: join(root, 'apps/server') });
    log.success('Synced environment variables and types');
  },
};
