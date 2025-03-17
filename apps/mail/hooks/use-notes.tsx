import {
	fetchNotes,
	fetchThreadNotes,
	createNote as createNoteAction,
	updateNote as updateNoteAction,
	deleteNote as deleteNoteAction,
	reorderNotes as reorderNotesAction,
} from '@/actions/notes';
import type { Note } from '@/app/api/notes/types';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { useCallback } from 'react';
import { toast } from 'sonner';

export type { Note };

const THREAD_NOTES_KEY = (threadId: string) => `thread-notes-${threadId}`;

export function useNotes() {
	const t = useTranslations();

	const {
		data: notes = [],
		error,
		isLoading,
		mutate: refreshNotes,
	} = useSWR<Note[]>('notes', async () => {
		try {
			const result = await fetchNotes();
			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch notes');
			}
			return result.data || [];
		} catch (err: any) {
			console.error('Error fetching notes:', err);
			toast.error(t('common.notes.errors.failedToLoadNotes'));
			throw err;
		}
	});

	const getNotesForThread = useCallback(
		async (threadId: string) => {
			try {
				const result = await fetchThreadNotes(threadId);
				if (!result.success) {
					throw new Error(result.error || 'Failed to fetch thread notes');
				}
				await mutate(THREAD_NOTES_KEY(threadId), result.data || []);
				return result.data || [];
			} catch (err: any) {
				console.error('Error fetching thread notes:', err);
				toast.error(t('common.notes.errors.failedToLoadThreadNotes'));
				return [];
			}
		},
		[t],
	);

	const hasNotes = useCallback(
		(threadId: string) => {
			return notes.some((note) => note.threadId === threadId);
		},
		[notes],
	);

	const addNote = useCallback(
		async (threadId: string, content: string, color: string = 'default'): Promise<Note | null> => {
			try {
				const result = await createNoteAction({
					threadId,
					content,
					color,
					isPinned: false,
				});

				if (!result.success) {
					throw new Error(result.error || 'Failed to add note');
				}

				const newNote = result.data;
				if (newNote) {
					await refreshNotes((prev) => [...(prev || []), newNote], { revalidate: false });
					await mutate(THREAD_NOTES_KEY(threadId));
					toast.success(t('common.notes.noteAdded'));
				}
				return newNote || null;
			} catch (err: any) {
				console.error('Error adding note:', err);
				toast.error(t('common.notes.errors.failedToAddNote'));
				return null;
			}
		},
		[t, refreshNotes],
	);

	const editNote = useCallback(
		async (noteId: string, content: string): Promise<Note | null> => {
			try {
				const result = await updateNoteAction(noteId, { content });

				if (!result.success) {
					throw new Error(result.error || 'Failed to update note');
				}

				const updatedNote = result.data;
				if (updatedNote) {
					await refreshNotes(
						(prev) => (prev || []).map((note) => (note.id === noteId ? updatedNote : note)),
						{ revalidate: false },
					);
					if (updatedNote.threadId) {
						await mutate(THREAD_NOTES_KEY(updatedNote.threadId));
					}
					toast.success(t('common.notes.noteUpdated'));
				}
				return updatedNote || null;
			} catch (err: any) {
				console.error('Error updating note:', err);
				toast.error(t('common.notes.errors.failedToUpdateNote'));
				return null;
			}
		},
		[t, refreshNotes],
	);

	const deleteNote = useCallback(
		async (noteId: string) => {
			try {
				const noteToDelete = notes.find((note) => note.id === noteId);
				const threadId = noteToDelete?.threadId;

				const result = await deleteNoteAction(noteId);

				if (!result.success) {
					throw new Error(result.error || 'Failed to delete note');
				}

				await refreshNotes((prev) => (prev || []).filter((note) => note.id !== noteId), {
					revalidate: false,
				});

				if (threadId) {
					await mutate(THREAD_NOTES_KEY(threadId));
				}

				toast.success(t('common.notes.noteDeleted'));
				return true;
			} catch (err: any) {
				console.error('Error deleting note:', err);
				toast.error(t('common.notes.errors.failedToDeleteNote'));
				return false;
			}
		},
		[notes, t, refreshNotes],
	);

	const togglePinNote = useCallback(
		async (noteId: string): Promise<Note | null> => {
			try {
				const noteToUpdate = notes.find((note) => note.id === noteId);
				if (!noteToUpdate) throw new Error('Note not found');

				const result = await updateNoteAction(noteId, {
					isPinned: !noteToUpdate.isPinned,
				});

				if (!result.success) {
					throw new Error(result.error || 'Failed to update note');
				}

				const updatedNote = result.data;
				if (updatedNote) {
					await refreshNotes(
						(prev) => (prev || []).map((note) => (note.id === noteId ? updatedNote : note)),
						{ revalidate: false },
					);

					if (updatedNote.threadId) {
						await mutate(THREAD_NOTES_KEY(updatedNote.threadId));
					}

					const pinStatus = updatedNote.isPinned
						? t('common.notes.notePinned')
						: t('common.notes.noteUnpinned');
					toast.success(pinStatus);
				}
				return updatedNote || null;
			} catch (err: any) {
				console.error('Error toggling pin status:', err);
				toast.error(t('common.notes.errors.failedToUpdateNote'));
				return null;
			}
		},
		[notes, t, refreshNotes],
	);

	const changeNoteColor = useCallback(
		async (noteId: string, color: string): Promise<Note | null> => {
			try {
				const result = await updateNoteAction(noteId, { color });

				if (!result.success) {
					throw new Error(result.error || 'Failed to update note color');
				}

				const updatedNote = result.data;
				if (updatedNote) {
					await refreshNotes(
						(prev) => (prev || []).map((note) => (note.id === noteId ? updatedNote : note)),
						{ revalidate: false },
					);

					if (updatedNote.threadId) {
						await mutate(THREAD_NOTES_KEY(updatedNote.threadId));
					}

					toast.success(t('common.notes.colorChanged'));
				}
				return updatedNote || null;
			} catch (err: any) {
				console.error('Error changing note color:', err);
				toast.error(t('common.notes.errors.failedToUpdateNoteColor'));
				return null;
			}
		},
		[t, refreshNotes],
	);

	const reorderNotes = useCallback(
		async (
			reorderedNotes: { id: string; order: number; isPinned?: boolean }[],
		): Promise<boolean> => {
			if (!reorderedNotes || reorderedNotes.length === 0) {
				console.warn('Attempted to reorder an empty array of notes');
				return true;
			}

			try {
				const validNoteIds = new Set(notes.map((note) => note.id));
				const allNotesValid = reorderedNotes.every((note) => validNoteIds.has(note.id));

				if (!allNotesValid) {
					console.warn('Some notes in reorder request do not exist locally, filtering them out');
					const validNotes = reorderedNotes.filter((note) => validNoteIds.has(note.id));

					if (validNotes.length === 0) {
						console.error('No valid notes to reorder after filtering');
						toast.error(t('common.notes.errors.noValidNotesToReorder'));
						return false;
					}

					reorderedNotes = validNotes;
				}

				await refreshNotes(
					(prev) => {
						const updatedNotes = [...(prev || [])];
						reorderedNotes.forEach(({ id, order, isPinned }) => {
							const index = updatedNotes.findIndex((note) => note.id === id);
							if (index !== -1) {
								const currentNote = updatedNotes[index];
								if (currentNote) {
									updatedNotes[index] = {
										...currentNote,
										order,
										isPinned: isPinned !== undefined ? isPinned : currentNote.isPinned,
									};
								}
							}
						});
						return [...updatedNotes].sort((a, b) => {
							if (!!a.isPinned !== !!b.isPinned) return a.isPinned ? -1 : 1;
							return a.order - b.order;
						});
					},
					{ revalidate: false },
				);

				console.log('Sending reorder request to server:', reorderedNotes);
				const result = await reorderNotesAction(reorderedNotes);

				if (!result.success) {
					throw new Error(result.error || 'Failed to reorder notes');
				}

				const threadIds = new Set<string>();
				notes.forEach((note) => {
					if (note.threadId && reorderedNotes.some((r) => r.id === note.id)) {
						threadIds.add(note.threadId);
					}
				});

				threadIds.forEach((threadId) => {
					mutate(THREAD_NOTES_KEY(threadId));
				});

				toast.success(t('common.notes.notesReordered'));
				return true;
			} catch (err: any) {
				console.error('Error reordering notes:', err);
				toast.error(t('common.notes.errors.failedToReorderNotes'));

				await refreshNotes();
				return false;
			}
		},
		[notes, refreshNotes, t],
	);

	return {
		notes,
		isLoading,
		error: error ? error.message : null,
		fetchNotes: refreshNotes,
		getNotesForThread,
		hasNotes,
		addNote,
		editNote,
		deleteNote,
		togglePinNote,
		changeNoteColor,
		reorderNotes,
	};
}
