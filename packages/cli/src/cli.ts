import { intro, select, isCancel, outro, log } from '@clack/prompts';
import * as commands from './commands';

let args = [];
if (process.argv.slice(2).length === 0) {
  intro(`Welcome to the Nizzy CLI`);

  const command = await select({
    message: `Hey ${process.env.USER}, what do you want to do?`,
    options: Object.values(commands).map((command) => ({
      label: command.description,
      value: command.id,
    })),
    maxItems: 5,
  });

  if (isCancel(command)) {
    outro('No worries, come back anytime!');
    process.exit(0);
  }

  args = [command];
} else {
  intro(`Nizzy CLI`);
  args = process.argv.slice(2);
}

if (['help', '-h', '--help'].includes(args[0])) {
  log.message('Available commands:');
  log.message(
    Object.values(commands)
      .map((command) => ` ${command.id.padStart(15)}    ${command.description}`)
      .join('\n'),
  );
  outro('Run `pnpm nizzy` for an interactive experience\n');
  process.exit(0);
}

const command = Object.values(commands).find((command) => command.id === args[0]);

if (!command) {
  outro("Umm, I don't know how to do that yet");
  process.exit(0);
}

await command.run();
outro(`Done!`);
process.exit(0);
