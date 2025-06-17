import { spawn, type SpawnOptions } from 'child_process';
import { readFile } from 'fs/promises';
import { log } from '@clack/prompts';
import { join } from 'path';

export const getProjectRoot = async () => {
  const cwd = process.cwd();
  const packageJson = await readFile(join(cwd, 'package.json'), 'utf8').catch(() => '{}');
  const packageJsonObject = JSON.parse(packageJson);
  const rootName = packageJsonObject.name;
  if (!rootName || rootName !== 'zero') {
    log.error(`Please run this command from the root of the project.`);
    process.exit(0);
  }
  return cwd;
};

export const runCommand = async (command: string, args: string[], options: SpawnOptions = {}) => {
  const useShell = process.platform === 'win32';
  const finalCommand = command;
  const finalArgs = args;
  
  const spawnOptions: SpawnOptions = {
    stdio: 'inherit',
    ...options,
    ...(useShell && options.shell === undefined ? { shell: true } : {})
  };
  
  const child = spawn(finalCommand, finalArgs, spawnOptions);

  await new Promise<void>((resolve, reject) => {
    child.once('close', () => resolve());
    child.once('error', (err) => reject(err));
  });
};

export const parseEnv = (env: string) => {
  return env
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) return null;

      const key = line.slice(0, equalIndex).trim();
      let value = line.slice(equalIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      return { key, value };
    })
    .filter((entry): entry is { key: string; value: string } => entry !== null);
};
