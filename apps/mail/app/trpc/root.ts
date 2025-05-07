import { router } from '@/app/trpc/trpc';
import { mailRouter } from '@/app/trpc/router/mail';

export const appRouter = router({
  mail: mailRouter,
});

export type AppRouter = typeof appRouter;
