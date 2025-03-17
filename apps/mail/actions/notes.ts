'use server';

import { notes } from '@/app/api/notes';
import type { Note } from '@/app/api/notes/types';

export type ActionResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function fetchNotes(): Promise<ActionResult<Note[]>> {
  try {
    const result = await notes.getNotes();
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch notes'
    };
  }
}

export async function fetchThreadNotes(threadId: string): Promise<ActionResult<Note[]>> {
  try {
    const result = await notes.getThreadNotes(threadId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error fetching thread notes:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch thread notes'
    };
  }
}

export async function createNote({
  threadId,
  content,
  color = 'default',
  isPinned = false
}: {
  threadId: string;
  content: string;
  color?: string;
  isPinned?: boolean;
}): Promise<ActionResult<Note>> {
  try {
    const result = await notes.createNote(threadId, content, color, isPinned);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error creating note:', error);
    return {
      success: false,
      error: error.message || 'Failed to create note'
    };
  }
}

export async function updateNote(
  noteId: string,
  data: Partial<Omit<Note, 'id' | 'userId' | 'threadId' | 'createdAt' | 'updatedAt'>>
): Promise<ActionResult<Note>> {
  try {
    const result = await notes.updateNote(noteId, data);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error updating note:', error);
    return {
      success: false,
      error: error.message || 'Failed to update note'
    };
  }
}

export async function deleteNote(noteId: string): Promise<ActionResult<boolean>> {
  try {
    const result = await notes.deleteNote(noteId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error deleting note:', error);
    return {
      success: false,
      error: error.message || 'Failed to delete note'
    };
  }
}

export async function reorderNotes(
  notesArray: { id: string; order: number; isPinned?: boolean }[]
): Promise<ActionResult<boolean>> {
  try {
    if (!notesArray || notesArray.length === 0) {
      console.warn('Attempted to reorder an empty array of notes');
      return { success: true, data: true };
    }
    
    console.log(`Reordering ${notesArray.length} notes:`, 
      notesArray.map(({id, order, isPinned}) => ({id, order, isPinned})));
    
    const result = await notes.reorderNotes(notesArray);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error reordering notes:', error);
    return {
      success: false,
      error: error.message || 'Failed to reorder notes'
    };
  }
} 