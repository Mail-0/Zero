// import {
//   command,
//   string as stringType,
//   number as numberType,
//   flag,
//   oneOf,
//   option,
//   boolean,
//   subcommands,
//   optional,
// } from 'cmd-ts';
// import { input, select, confirm, number as numberPrompt } from '@inquirer/prompts';
// import { updateWritingStyleMatrix } from '../services/writing-style-service';
// import professionalEmails from './styles/professional_emails.json';
// import persuasiveEmails from './styles/persuasive_emails.json';
// import friendlyEmails from './styles/friendly_emails.json';
// import conciseEmails from './styles/concise_emails.json';
// import { writingStyleMatrix } from '@zero/db/schema';
// import genZEmails from './styles/genz_emails.json';
// import { keys, take } from 'remeda';
// import { eq } from 'drizzle-orm';
// import { db } from '@zero/db';
// import pRetry from 'p-retry';
// import pAll from 'p-all';

// const mapping = {
//   professional: professionalEmails,
//   persuasive: persuasiveEmails,
//   genz: genZEmails,
//   concise: conciseEmails,
//   friendly: friendlyEmails,
// } as const;

// const runSeeder = async (connectionId: string, style: keyof typeof mapping, size: number) => {
//   console.warn(
//     'Seeding style matrix for connection',
//     connectionId,
//     'based on',
//     size,
//     'mock emails.',
//   );

//   const testDataSet = take(mapping[style], size);

//   await pAll(
//     testDataSet.map((email, index) => async () => {
//       console.warn('Seeding email', index);
//       await pRetry(
//         async () => {
//           try {
//             await updateWritingStyleMatrix(connectionId, email.body);
//           } catch (error) {
//             console.error(error);

//             throw error;
//           }
//         },
//         {
//           retries: 5,
//           maxTimeout: 60_000,
//           minTimeout: 1_000,
//         },
//       );
//     }),
//     { concurrency: 1 },
//   );

//   console.warn('Seeded style matrix for connection', connectionId);
// };

// const runResetStyleMatrix = async (connectionId: string) => {
//   await db.delete(writingStyleMatrix).where(eq(writingStyleMatrix.connectionId, connectionId));
// };

// const seed = command({
//   name: 'seed-style-matrix',
//   args: {
//     connectionId: option({
//       type: optional(stringType),
//       long: 'connection-id',
//       short: 'c',
//       description: 'Connection ID to seed the generated style matrix for',
//     }),
//     style: option({
//       type: optional(oneOf(keys(mapping))),
//       description: 'Style to seed the generated style matrix for',
//       long: 'style',
//       short: 's',
//     }),
//     size: option({
//       type: optional(numberType),
//       description: 'Number of emails to seed',
//       long: 'size',
//       short: 'n',
//       defaultValue: () => {
//         return 10;
//       },
//     }),
//     resetStyleMatrix: flag({
//       type: optional(boolean),
//       description: 'Reset the style matrix before seeding',
//       long: 'reset',
//       short: 'r',
//       defaultValue: () => {
//         return false;
//       },
//     }),
//   },
//   handler: async (inputs) => {
//     const connectionId = inputs.connectionId ?? (await getConnectionId());
//     const style = inputs.style ?? (await getStyle());
//     const resetStyleMatrix = inputs.resetStyleMatrix ?? (await getResetStyleMatrix(connectionId));
//     const size = inputs.size ?? (await getNumberOfEmails(mapping[style].length));

//     if (resetStyleMatrix) {
//       await runResetStyleMatrix(connectionId);
//     }

//     await runSeeder(connectionId, style, size);
//   },
// });

// const reset = command({
//   name: 'reset',
//   args: {
//     connectionId: option({
//       type: optional(stringType),
//       long: 'connection-id',
//       short: 'c',
//       description: 'Connection ID to seed the generated style matrix for',
//     }),
//   },
//   handler: async (inputs) => {
//     const connectionId = inputs.connectionId ?? (await getConnectionId());

//     const confirmed = await confirm({
//       message: `Reset the style matrix for Connection ID (${connectionId})?`,
//     });

//     if (confirmed) {
//       console.warn('Resetting style matrix for connection', connectionId);
//       await runResetStyleMatrix(connectionId);
//       console.warn('Reset style matrix for connection', connectionId);
//     } else {
//       console.warn('Aborted reset');
//     }
//   },
// });

// const getConnectionId = async () => {
//   return input({
//     message: 'Connection ID to seed:',
//     required: true,
//     validate: async (value) => {
//       const connection = await db.query.connection.findFirst({
//         where: (table, ops) => {
//           return ops.eq(table.id, value);
//         },
//         columns: {
//           id: true,
//         },
//       });

//       return connection ? true : 'Invalid Connection ID';
//     },
//   });
// };

// const getStyle = async () => {
//   return select<keyof typeof mapping>({
//     message: 'Style to seed the generated style matrix for',
//     choices: keys(mapping),
//   });
// };

// const getResetStyleMatrix = async (connectionId: string) => {
//   return confirm({
//     message: `Reset the style matrix for Connection ID (${connectionId}) before seeding?`,
//     default: true,
//   });
// };

// const getNumberOfEmails = async (maxSize: number) => {
//   return numberPrompt({
//     message: 'Number of emails to seed',
//     default: 10,
//     max: maxSize,
//     min: 0,
//     required: true,
//   });
// };

// export const seedStyleCommand = subcommands({
//   name: 'seed-style',
//   description: 'Seed style matrix for a given Connection ID',
//   cmds: {
//     seed,
//     reset,
//   },
// });
