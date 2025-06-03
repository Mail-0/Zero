import { privateProcedure, router } from '../trpc';

export const userRouter = router({
  delete: privateProcedure.mutation(async ({ ctx }) => {
    const { success, message } = await ctx.c.var.auth.api.deleteUser({
      body: {
        callbackURL: '/',
      },
      headers: ctx.c.req.raw.headers,
      request: ctx.c.req.raw,
    });
    return { success, message };
  }),
});
