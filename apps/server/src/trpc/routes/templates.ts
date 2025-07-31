import { TemplatesManager } from '../../lib/templates-manager';
import { privateProcedure, router } from '../trpc';
import { z } from 'zod';

const templatesProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const templatesManager = new TemplatesManager();
  return next({ ctx: { ...ctx, templatesManager } });
});

export const templatesRouter = router({
  list: templatesProcedure.query(async ({ ctx }) => {
    const templates = await ctx.templatesManager.listTemplates(ctx.sessionUser.id);
    return { templates };
  }),
  create: templatesProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().default(''),
        body: z.string().default(''),
        to: z.array(z.string()).optional(),
        cc: z.array(z.string()).optional(),
        bcc: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.templatesManager.createTemplate(ctx.sessionUser.id, input);
      return { template };
    }),
  delete: templatesProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.templatesManager.deleteTemplate(ctx.sessionUser.id, input.id);
      return { success: true };
    }),
}); 