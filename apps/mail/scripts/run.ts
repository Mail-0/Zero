import { subcommands, run } from 'cmd-ts'
import { seedStyleCommand } from '@zero/mail/scripts/seed-style/seeder';

const app = subcommands({
  name: 'scripts',
  cmds: {
    'seed-style': seedStyleCommand,
  },
})

await run(app, process.argv.slice(2))
process.exit(0)
