import { subcommands, run } from 'cmd-ts'
import { seedStyleMatrixCommand } from '@zero/mail/scripts/seed-style-matrix/seeder';

const app = subcommands({
  name: 'scripts',
  cmds: {
    'seed-style': seedStyleMatrixCommand,
  },
})

await run(app, process.argv.slice(2))
process.exit(0)
