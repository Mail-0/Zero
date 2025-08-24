export type Command = {
  id: string;
  description: string;
  run: () => Promise<void>;
};

export { command as fixEnv } from './fix-env';
export { command as reinstallNodeModules } from './reinstall-node-modules';
export { command as sync } from './sync';
