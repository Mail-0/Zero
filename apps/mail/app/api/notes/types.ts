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

export interface NotesManager {
  getNotes(userId: string): Promise<Note[]>;

  getThreadNotes(userId: string, threadId: string): Promise<Note[]>;

  createNote(
    userId: string,
    threadId: string,
    content: string,
    color?: string,
    isPinned?: boolean
  ): Promise<Note>;

  updateNote(
    userId: string,
    noteId: string,
    data: Partial<Omit<Note, 'id' | 'userId' | 'threadId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Note>;

  deleteNote(userId: string, noteId: string): Promise<boolean>;

  reorderNotes(
    userId: string,
    notes: { id: string; order: number; isPinned?: boolean | null }[]
  ): Promise<boolean>;
}
