import { notesManager } from '@/lib/notes-manager';
import { privateProcedure, router } from '../trpc';
import { z } from 'zod';

export const notesRouter = router({
  list: privateProcedure.input(z.object({ threadId: z.string() })).query(async ({ ctx, input }) => {
    const notes = await notesManager.getThreadNotes(ctx.session.user.id, input.threadId);
    return { notes };
  }),
  create: privateProcedure
    .input(
      z.object({
        threadId: z.string(),
        content: z.string(),
        color: z.string().optional().default('default'),
        isPinned: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { threadId, color, content, isPinned } = input;
      const note = await notesManager.createNote(
        ctx.session.user.id,
        threadId,
        content,
        color,
        isPinned,
      );
      return { note };
    }),
  update: privateProcedure
    .input(
      z.object({
        noteId: z.string(),
        data: z
          .object({
            threadId: z.string(),
            content: z.string(),
            color: z.string().optional().default('default'),
            isPinned: z.boolean().optional().default(false),
          })
          .partial(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const note = await notesManager.updateNote(ctx.session.user.id, input.noteId, input.data);
      return { note };
    }),
  delete: privateProcedure
    .input(z.object({ noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await notesManager.deleteNote(ctx.session.user.id, input.noteId);
      return { success };
    }),
  reorder: privateProcedure
    .input(
      z.object({
        notes: z.array(
          z.object({
            id: z.string(),
            order: z.number(),
            isPinned: z.boolean().optional().nullable(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { notes } = input;
      if (!notes || notes.length === 0) {
        console.warn('Attempted to reorder an empty array of notes');
        return { success: true };
      }

      console.log(
        `Reordering ${notes.length} notes:`,
        notes.map(({ id, order, isPinned }) => ({ id, order, isPinned })),
      );

      const result = await notesManager.reorderNotes(ctx.session.user.id, notes);
      return { success: result };
    }),
});
