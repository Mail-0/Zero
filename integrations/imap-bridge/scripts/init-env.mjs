import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const target = new URL('../.env', import.meta.url);
const content = [
  `BRIDGE_SECRET=${randomBytes(32).toString('hex')}`,
  `BRIDGE_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`,
  'BRIDGE_ALLOWED_MAIL_HOSTS=',
  'BRIDGE_ALLOWED_AI_ORIGINS=',
  'BRIDGE_PORT=3033',
  '',
].join('\n');
try {
  await writeFile(target, content, { flag: 'wx', mode: 0o600 });
  console.info('Created .env with restrictive permissions. Existing files are never overwritten. Back up the encryption key separately.');
} catch (error) {
  if (error.code === 'EEXIST') console.error('.env already exists; refusing to rotate keys or overwrite configuration.');
  else console.error('Unable to create .env. Check directory permissions.');
  process.exitCode = 1;
}
