import { auth } from '@/lib/auth';
import { notesManager } from './db';
import type { Note } from './types';
import { headers } from 'next/headers';
export type { Note } from './types';

async function getCurrentUserId(): Promise<string> {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }
    return session.user.id;
  } catch (error) {
    console.error('Error getting current user ID:', error);
    throw new Error('Authentication failed');
  }
}

export const notes = {
  async getThreadNotes(threadId: string): Promise<Note[]> {
    try {
      const userId = await getCurrentUserId();
      return await notesManager.getThreadNotes(userId, threadId);
    } catch (error) {
      console.error(`Error getting thread notes for threadId ${threadId}:`, error);
      throw error;
    }
  },

  async createNote(
    threadId: string,
    content: string,
    color: string = 'default',
    isPinned: boolean = false
  ): Promise<Note> {
    try {
      const userId = await getCurrentUserId();
      return await notesManager.createNote(userId, threadId, content, color, isPinned);
    } catch (error) {
      console.error(`Error creating note in thread ${threadId}:`, error);
      throw error;
    }
  },

  async updateNote(
    noteId: string,
    data: Partial<Omit<Note, 'id' | 'userId' | 'threadId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Note> {
    try {
      const userId = await getCurrentUserId();
      return await notesManager.updateNote(userId, noteId, data);
    } catch (error) {
      console.error(`Error updating note ${noteId}:`, error);
      throw error;
    }
  },

  async deleteNote(noteId: string): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      return await notesManager.deleteNote(userId, noteId);
    } catch (error) {
      console.error(`Error deleting note ${noteId}:`, error);
      throw error;
    }
  },

  async reorderNotes(
    notesArray: { id: string; order: number; isPinned?: boolean | null }[]
  ): Promise<boolean> {
    try {
      const userId = await getCurrentUserId();
      return await notesManager.reorderNotes(userId, notesArray);
    } catch (error) {
      console.error('Error reordering notes:', error);
      throw error;
    }
  }
};

export * from './types';
