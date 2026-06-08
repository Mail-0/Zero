import {
  createUserCategory,
  deleteUserCategory,
  getOrCreateUserCategories,
  updateUserCategory,
} from '../../services/category-service';
import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const categorySchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  promptHint: z.string(),
  enabled: z.boolean(),
});

const categoryInputSchema = z.object({
  categoryName: z.string().min(1),
  promptHint: z.string().default(''),
});

export const categoriesRouter = router({
  list: privateProcedure.output(z.array(categorySchema)).query(async ({ ctx }) => {
    try {
      return await getOrCreateUserCategories(ctx.c.env, ctx.sessionUser.id);
    } catch (error) {
      console.error('[CATEGORIES] Failed to list categories', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load categories',
      });
    }
  }),
  create: privateProcedure
    .input(categoryInputSchema)
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createUserCategory(ctx.c.env, ctx.sessionUser.id, input);
      } catch (error) {
        console.error('[CATEGORIES] Failed to create category', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create category',
        });
      }
    }),
  update: privateProcedure
    .input(
      z.object({
        categoryId: z.string(),
        categoryName: z.string().min(1),
        promptHint: z.string().default(''),
      }),
    )
    .output(categorySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { categoryId, ...payload } = input;
        return await updateUserCategory(ctx.c.env, ctx.sessionUser.id, categoryId, payload);
      } catch (error) {
        console.error('[CATEGORIES] Failed to update category', error);
        throw new TRPCError({
          code: error instanceof Error && error.message === 'Category not found'
            ? 'NOT_FOUND'
            : 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error && error.message === 'Category not found'
              ? 'Category not found'
              : 'Failed to update category',
        });
      }
    }),
  delete: privateProcedure
    .input(z.object({ categoryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteUserCategory(ctx.c.env, ctx.sessionUser.id, input.categoryId);
        return { success: true };
      } catch (error) {
        console.error('[CATEGORIES] Failed to delete category', error);
        throw new TRPCError({
          code: error instanceof Error && error.message === 'Category not found'
            ? 'NOT_FOUND'
            : 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error && error.message === 'Category not found'
              ? 'Category not found'
              : 'Failed to delete category',
        });
      }
    }),
});
