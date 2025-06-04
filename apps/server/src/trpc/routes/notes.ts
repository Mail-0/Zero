import { NotesManager } from '../../lib/notes-manager';
import { privateProcedure, router } from '../trpc';
import { z } from 'zod';

const notesProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const notesManager = new NotesManager(ctx.db);
  return next({ ctx: { ...ctx, notesManager } });
});

export const notesRouter = router({
  list: notesProcedure.input(z.object({ threadId: z.string() })).query(async ({ ctx, input }) => {
    const notes = await ctx.notesManager.getThreadNotes(ctx.sessionUser.id, input.threadId);
    return { notes };
  }),
  create: notesProcedure
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
      const note = await ctx.notesManager.createNote(
        ctx.sessionUser.id,
        threadId,
        content,
        color,
        isPinned,
      );
      return { note };
    }),
  update: notesProcedure
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
      const note = await ctx.notesManager.updateNote(ctx.sessionUser.id, input.noteId, input.data);
      return { note };
    }),
  delete: notesProcedure
    .input(z.object({ noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.notesManager.deleteNote(ctx.sessionUser.id, input.noteId);
      return { success };
    }),
  reorder: notesProcedure
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

      const result = await ctx.notesManager.reorderNotes(ctx.sessionUser.id, notes);
      return { success: result };
    }),
});
