# Scripts

This folder contains utility scripts for the Zero email application. These scripts are designed to help with development, testing, and maintenance tasks that are not part of the main application flow.

## Overview

The scripts system in Zero is built using [cmd-ts](https://github.com/Schniz/cmd-ts), a TypeScript library for building type-safe command-line applications. This provides a structured way to create, organize, and run utility scripts with proper command-line argument handling, help text, and more.

## How to Run Scripts

Scripts can be run using the `scripts` command from the project root:

```bash
# Run a script from the project root
pnpm scripts <script-name> [options]

# Example: Run the seed-style script
pnpm scripts seed-style
```

This command is defined in the root `package.json` and executes the script runner in the mail app:

```json
"scripts": "dotenv -- pnpm run --cwd apps/mail --silent --elide-lines=0 scripts"
```

## Available Scripts

### seed-style

Seeds the writing style matrix for a given connection with sample emails of different styles. This is useful for testing and developing the writing style features of the application.

**Usage:**

```bash
# Interactive mode (will prompt for options)
pnpm scripts seed-style

# With command-line options
pnpm scripts seed-style seed --connection-id <id> --style <style> --size <number> [--reset]
# Or reset the style matrix
pnpm scripts seed-style reset --connection-id <id>
```

**Options:**

- `--connection-id, -c`: The connection ID to seed the style matrix for
- `--style, -s`: The style to use (professional, persuasive, genz, concise, friendly)
- `--size, -n`: Number of emails to seed (default: 10)
- `--reset, -r`: Reset the style matrix before seeding

**Subcommands:**

- `seed`: Seeds the style matrix with sample emails
- `reset`: Resets the style matrix for a connection

## How to Add New Scripts

To add a new script to the system:

1. Create a new script file in the `apps/mail/scripts` directory or a subdirectory
2. Export a command object using the cmd-ts library
3. Register the command in `apps/mail/scripts/run.ts`

### Step 1: Create a new script file

Create a new TypeScript file for your script. For example, `apps/mail/scripts/my-script.ts`:

```typescript
import { command, option, string as stringType } from 'cmd-ts';

export const myScriptCommand = command({
  name: 'my-script',
  description: 'Description of what my script does',
  args: {
    // Define command-line arguments
    param1: option({
      type: stringType,
      long: 'param1',
      short: 'p',
      description: 'Description of param1',
    }),
  },
  handler: async (inputs) => {
    // Script implementation
    console.log(`Running my script with param1: ${inputs.param1}`);
    // Do something useful here
  },
});
```

### Step 2: Register the command

Update `apps/mail/scripts/run.ts` to include your new command:

```typescript
import { seedStyleCommand } from '@zero/mail/scripts/seed-style/seeder';
import { myScriptCommand } from '@zero/mail/scripts/my-script';
import { subcommands, run } from 'cmd-ts';

const app = subcommands({
  name: 'scripts',
  cmds: {
    'seed-style': seedStyleCommand,
    'my-script': myScriptCommand, // Add your new command here
  },
});

await run(app, process.argv.slice(2));
process.exit(0);
```

### Step 3: Run your script

You can now run your script using:

```bash
pnpm scripts my-script --param1 value
```

## Best Practices

When creating scripts:

1. **Use cmd-ts features**: Take advantage of the cmd-ts library for argument parsing, validation, and help text
2. **Interactive mode**: Consider supporting both interactive mode (using prompts) and command-line options
3. **Error handling**: Implement proper error handling and provide useful error messages
4. **Documentation**: Document your script's purpose, usage, and options in this README
5. **Modularity**: Break complex scripts into smaller, reusable functions
6. **Testing**: Consider adding tests for critical script functionality

## Dependencies

The scripts system uses several key dependencies:

- [cmd-ts](https://github.com/Schniz/cmd-ts): Command-line parsing and execution
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js): Interactive command-line prompts
- [p-all](https://github.com/sindresorhus/p-all): Run promises in parallel with limited concurrency
- [p-retry](https://github.com/sindresorhus/p-retry): Retry failed promises
