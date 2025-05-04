import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { cookiePreferencesRouter } from './routes/cookies';
import { earlyAccessRouter } from './routes/early-access';
import { connectionsRouter } from './routes/connections';
import { shortcutRouter } from './routes/shortcut';
import { settingsRouter } from './routes/settings';
import { draftsRouter } from './routes/drafts';
import { labelsRouter } from './routes/label';
import { brainRouter } from './routes/brain';
import { notesRouter } from './routes/notes';
import { mailRouter } from './routes/mail';
import { userRouter } from './routes/user';
import type { HonoContext } from './hono';
import { aiRouter } from './routes/ai';
import { router } from './trpc';

export const appRouter = router({
  ai: aiRouter,
  brain: brainRouter,
  connections: connectionsRouter,
  cookiePreferences: cookiePreferencesRouter,
  drafts: draftsRouter,
  earlyAccess: earlyAccessRouter,
  labels: labelsRouter,
  mail: mailRouter,
  notes: notesRouter,
  shortcut: shortcutRouter,
  settings: settingsRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export type Inputs = inferRouterInputs<AppRouter>;
export type Outputs = inferRouterOutputs<AppRouter>;

export const serverTrpc = (c: HonoContext) =>
  appRouter.createCaller({ c, session: c.var.session, db: c.var.db });
