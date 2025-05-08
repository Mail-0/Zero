import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { note } from '@zero/db/schema';
import type { DB } from '@zero/db';

export interface Note {
  id: string;
  userId: string;
  threadId: string;
  content: string;
  color: string;
  isPinned: boolean | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export class NotesManager {
  constructor(private db: DB) {}
  async getNotes(userId: string): Promise<Note[]> {
    return this.db
      .select()
      .from(note)
      .where(eq(note.userId, userId))
      .orderBy(desc(note.isPinned), asc(note.order), desc(note.createdAt));
  }

  async getThreadNotes(userId: string, threadId: string): Promise<Note[]> {
    return this.db
      .select()
      .from(note)
      .where(and(eq(note.userId, userId), eq(note.threadId, threadId)))
      .orderBy(desc(note.isPinned), asc(note.order), desc(note.createdAt));
  }

  async createNote(
    userId: string,
    threadId: string,
    content: string,
    color: string = 'default',
    isPinned: boolean = false,
  ): Promise<Note> {
    const userNotes = await this.db
      .select()
      .from(note)
      .where(eq(note.userId, userId))
      .orderBy(desc(note.order));

    const highestOrder = userNotes[0]?.order ?? -1;

    const result = await this.db
      .insert(note)
      .values({
        id: sql`gen_random_uuid()`,
        userId,
        threadId,
        content,
        color,
        isPinned,
        order: highestOrder + 1,
      })
      .returning();

    if (!result[0]) {
      throw new Error('Failed to create note');
    }
    return result[0];
  }

  async updateNote(
    userId: string,
    noteId: string,
    data: Partial<Omit<Note, 'id' | 'userId' | 'threadId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Note> {
    const existingNote = await this.db
      .select()
      .from(note)
      .where(and(eq(note.id, noteId), eq(note.userId, userId)))
      .limit(1);

    if (existingNote.length === 0) {
      throw new Error('Note not found or unauthorized');
    }

    const result = await this.db
      .update(note)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(note.id, noteId))
      .returning();

    if (!result[0]) {
      throw new Error('Failed to update note');
    }
    return result[0];
  }

  async deleteNote(userId: string, noteId: string): Promise<boolean> {
    const existingNote = await this.db
      .select()
      .from(note)
      .where(and(eq(note.id, noteId), eq(note.userId, userId)))
      .limit(1);

    if (existingNote.length === 0) {
      throw new Error('Note not found or unauthorized');
    }

    await this.db.delete(note).where(eq(note.id, noteId));

    return true;
  }

  async reorderNotes(
    userId: string,
    notes: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    if (!notes || notes.length === 0) {
      return true;
    }

    const noteIds = notes.map((n) => n.id);

    const userNotes = await this.db
      .select({ id: note.id })
      .from(note)
      .where(
        and(
          eq(note.userId, userId),
          sql`${note.id} IN (${sql.join(
            noteIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    const foundNoteIds = new Set(userNotes.map((n) => n.id));

    if (foundNoteIds.size !== noteIds.length) {
      const missingNotes = noteIds.filter((id) => !foundNoteIds.has(id));
      console.error(`Notes not found or unauthorized: ${missingNotes.join(', ')}`);
      throw new Error('One or more notes not found or unauthorized');
    }

    return await this.db
      .transaction(async (tx) => {
        for (const n of notes) {
          const updateData: Record<string, unknown> = {
            order: n.order,
            updatedAt: new Date(),
          };

          if (n.isPinned !== undefined) {
            updateData.isPinned = n.isPinned;
          }

          await tx
            .update(note)
            .set(updateData)
            .where(and(eq(note.id, n.id), eq(note.userId, userId)));
        }

        return true;
      })
      .catch((error) => {
        console.error('Error in reorderNotes transaction:', error);
        throw new Error('Failed to reorder notes: ' + error.message);
      });
  }
}
