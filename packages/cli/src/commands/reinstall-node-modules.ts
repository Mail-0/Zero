import { getProjectRoot, runCommand } from '../utils';
import { log, spinner } from '@clack/prompts';
import { rm } from 'fs/promises';
import type { Command } from '.';
import glob from 'tiny-glob';
import { join } from 'path';

export const command: Command = {
  id: 'reinstall',
  description: 'Reinstall node modules',
  run: async () => {
    const root = await getProjectRoot();
    const removePackagesSpinner = spinner();
    removePackagesSpinner.start('Removing node_modules');
    const nodeModuleFolders = await glob('**/*/node_modules', { cwd: root });
    await Promise.all(
      nodeModuleFolders.map((folder) => rm(join(root, folder), { recursive: true, force: true })),
    );
    removePackagesSpinner.stop('Removed node_modules');
    log.step('Reinstalling node_modules');
    await runCommand('pnpm', ['install']);
    log.step('Reinstalled node_modules');
  },
};
