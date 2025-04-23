import { headers } from 'next/headers';
import type { Note } from './types';
import { notesManager } from './db';
import { auth } from '@/lib/auth';
export type { Note } from './types';

async function getCurrentUserId() {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });
    return session?.user.id ?? null;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    throw new Error('Authentication failed');
  }
}

export const notes = {
  async getThreadNotes(threadId: string): Promise<Note[]> {
    try {
      const userId = await getCurrentUserId();
      if (userId) return await notesManager.getThreadNotes(userId, threadId);
      return [];
    } catch (error) {
      console.error(`Error getting thread notes for threadId ${threadId}:`, error);
      throw error;
    }
  },

  async createNote(
    threadId: string,
    content: string,
    color: string = 'default',
    isPinned: boolean = false,
  ) {
    try {
      const userId = await getCurrentUserId();
      if (userId) return await notesManager.createNote(userId, threadId, content, color, isPinned);
      return null;
    } catch (error) {
      console.error(`Error creating note in thread ${threadId}:`, error);
      throw error;
    }
  },

  async updateNote(
    noteId: string,
    data: Partial<Omit<Note, 'id' | 'userId' | 'threadId' | 'createdAt' | 'updatedAt'>>,
  ) {
    try {
      const userId = await getCurrentUserId();
      if (userId) return await notesManager.updateNote(userId, noteId, data);
      return null;
    } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      throw error;
    }
  },

  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (userId) return await notesManager.deleteNote(userId, noteId);
      return false;
    } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      throw error;
    }
  },

  async reorderNotes(
    notesArray: { id: string; order: number; isPinned?: boolean | null }[],
  ): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      if (userId) return await notesManager.reorderNotes(userId, notesArray);
      return false;
    } catch (error) {
      console.error('Error reordering notes:', error);
      throw error;
    }
  },
};

export * from './types';
