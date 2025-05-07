import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  NOTE_COLORS,
  getNoteColorClass,
  getNoteColorStyle,
  formatRelativeTime,
  formatDate,
  borderToBackgroundColorClass,
  assignOrdersAfterPinnedReorder,
  assignOrdersAfterUnpinnedReorder,
  sortNotesByOrder,
} from '@/lib/notes-utils';
import {
  StickyNote,
  Edit,
  Trash2,
  X,
  PlusCircle,
  Copy,
  Clock,
  Search,
  AlertCircle,
  Pin,
  PinOff,
  GripVertical,
  PaintBucket,
  MoreVertical,
} from 'lucide-react';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTRPC } from '@/providers/query-provider';
import { Textarea } from '@/components/ui/textarea';
import { useMutation } from '@tanstack/react-query';
import { useThreadNotes } from '@/hooks/use-notes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CSS } from '@dnd-kit/utilities';
import type { Note } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NotesPanelProps {
  threadId: string;
}

function SortableNote({
  note,
  onEdit,
  onCopy,
  onTogglePin,
  onDelete,
  onColorChange,
}: {
  note: Note;
  onEdit: () => void;
  onCopy: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onColorChange: (color: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    useSortable({
      id: note.id,
    });

  const t = useTranslations();
  const format = useFormatter();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-muted group relative mb-3 overflow-hidden rounded-md border p-3',
        note.isPinned && 'ring-1 ring-amber-200 dark:ring-amber-800',
      )}
    >
      <div
        className={cn(
          'absolute bottom-0 left-0 top-0 w-1.5 border-l-4',
          note.color !== 'default' ? getNoteColorClass(note.color) : 'border-transparent',
        )}
        style={note.color !== 'default' ? getNoteColorStyle(note.color) : {}}
      />

      <div className="flex items-start gap-3 pl-1.5">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm">{note.content}</p>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-muted-foreground mt-2 flex cursor-default items-center text-xs">
                <Clock className="mr-1 h-3 w-3" />
                <span>{formatRelativeTime(note.createdAt, format)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {note.updatedAt > note.createdAt ? (
                <>
                  <p>
                    {t('common.notes.created')}: {formatDate(note.createdAt, format)}
                  </p>
                  <p>
                    {t('common.notes.updated')}: {formatDate(note.updatedAt, format)}
                  </p>
                </>
              ) : (
                <p>
                  {t('common.notes.created')}: {formatDate(note.createdAt, format)}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center">
          <div
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            className="cursor-grab opacity-30 group-hover:opacity-100"
          >
            <GripVertical className="text-muted-foreground h-4 w-4" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 opacity-30 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="mr-2 h-4 w-4" />
                <span>{t('common.notes.actions.edit')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="mr-2 h-4 w-4" />
                <span>{t('common.notes.actions.copy')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTogglePin}>
                {note.isPinned ? (
                  <>
                    <PinOff className="mr-2 h-4 w-4" />
                    <span>{t('common.notes.actions.unpin')}</span>
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-4 w-4" />
                    <span>{t('common.notes.actions.pin')}</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <PaintBucket className="mr-2 h-4 w-4" />
                  <span>{t('common.notes.actions.changeColor')}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuRadioGroup value={note.color} onValueChange={onColorChange}>
                      {NOTE_COLORS.map((color) => {
                        return (
                          <DropdownMenuRadioItem key={color.value} value={color.value}>
                            <div className="flex items-center">
                              <div
                                className={cn(
                                  'mr-2 h-3 w-3 rounded-full',
                                  color.value !== 'default'
                                    ? borderToBackgroundColorClass(color.class)
                                    : 'border-border border bg-transparent',
                                )}
                              />
                              <span>{t(`common.notes.colors.${color.value}` as any)}</span>
                            </div>
                          </DropdownMenuRadioItem>
                        );
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive-foreground">
                <Trash2 className="mr-2 h-4 w-4" />
                <span>{t('common.notes.actions.delete')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export function NotesPanel({ threadId }: NotesPanelProps) {
  const {
    data: { notes },
    refetch,
  } = useThreadNotes(threadId);
  const [isOpen, setIsOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isAddingNewNote, setIsAddingNewNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('default');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();
  const trpc = useTRPC();
  const { mutateAsync: createNote } = useMutation(trpc.notes.create.mutationOptions());
  const { mutateAsync: updateNote } = useMutation(trpc.notes.update.mutationOptions());
  const { mutateAsync: deleteNote } = useMutation(trpc.notes.delete.mutationOptions());
  const { mutateAsync: reorderNotes } = useMutation(trpc.notes.reorder.mutationOptions());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (isAddingNewNote && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAddingNewNote]);

  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingNoteId]);

  const handleAddNote = async () => {
    if (newNoteContent.trim()) {
      const noteData = {
        threadId,
        color: selectedColor !== 'default' ? selectedColor : undefined,
        content: newNoteContent.trim(),
      };

      const promise = async () => {
        setIsAddingNewNote(true);
        await createNote(noteData);
        await refetch();
        setNewNoteContent('');
        setSelectedColor('default');
        setIsAddingNewNote(false);
      };

      toast.promise(promise(), {
        loading: t('common.actions.loading'),
        success: t('common.notes.noteAdded'),
        error: t('common.notes.errors.failedToAddNote'),
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, action: 'add' | 'edit') => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (action === 'add') {
        void handleAddNote();
      } else {
        void handleEditNote();
      }
    }
  };

  const handleEditNote = async () => {
    if (editingNoteId && editContent.trim()) {
      const noteId = editingNoteId;
      const contentToSave = editContent.trim();

      setEditingNoteId(null);
      setEditContent('');

      const promise = async () => {
        await updateNote({
          noteId,
          data: {
            content: contentToSave,
          },
        });
        await refetch();
      };

      toast.promise(promise(), {
        loading: t('common.actions.saving'),
        success: t('common.notes.noteUpdated'),
        error: t('common.notes.errors.failedToUpdateNote'),
      });
    }
  };

  const startEditing = (note: Note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote({ noteId });
      await refetch();
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  };

  const confirmDeleteNote = (noteId: string) => {
    // TODO: Dialog is bugged? needs to be fixed then implement a confirmation dialog
    const promise = handleDeleteNote(noteId);
    toast.promise(promise, {
      loading: t('common.actions.loading'),
      success: t('common.notes.noteDeleted'),
      error: t('common.notes.errors.failedToDeleteNote'),
    });
  };

  const handleCopyNote = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t('common.notes.noteCopied'));
  };

  const togglePinNote = async (noteId: string, isPinned: boolean) => {
    const action = updateNote({
      noteId,
      data: { isPinned: !isPinned },
    });

    toast.promise(action, {
      loading: t('common.actions.loading'),
      success: isPinned ? t('common.notes.noteUnpinned') : t('common.notes.notePinned'),
      error: t('common.notes.errors.failedToUpdateNote'),
    });

    await action;
    return await refetch();
  };

  const handleChangeNoteColor = async (noteId: string, color: string) => {
    const action = updateNote({
      noteId,
      data: {
        color,
      },
    });

    toast.promise(action, {
      loading: t('common.actions.loading'),
      success: t('common.notes.colorChanged'),
      error: t('common.notes.errors.failedToUpdateNoteColor'),
    });

    await action;
    return await refetch();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeNote = notes.find((n) => n.id === active.id);
      const overNote = notes.find((n) => n.id === over.id);

      if (!activeNote || !overNote || activeNote.isPinned !== overNote.isPinned) {
        setActiveId(null);
        return;
      }

      const pinnedNotes = notes.filter((note) => note.isPinned);
      const unpinnedNotes = notes.filter((note) => !note.isPinned);

      if (activeNote.isPinned) {
        const oldIndex = pinnedNotes.findIndex((n) => n.id === active.id);
        const newIndex = pinnedNotes.findIndex((n) => n.id === over.id);
        const newPinnedNotes = arrayMove(pinnedNotes, oldIndex, newIndex);

        const reorderedPinnedNotes = assignOrdersAfterPinnedReorder(newPinnedNotes);

        const newNotes = [...reorderedPinnedNotes, ...unpinnedNotes];
        const action = reorderNotes({ notes: newNotes });

        toast.promise(action, {
          loading: t('common.actions.loading'),
          success: t('common.notes.notesReordered'),
          error: t('common.notes.errors.failedToReorderNotes'),
        });

        await action;
        await refetch();
      } else {
        const oldIndex = unpinnedNotes.findIndex((n) => n.id === active.id);
        const newIndex = unpinnedNotes.findIndex((n) => n.id === over.id);
        const newUnpinnedNotes = arrayMove(unpinnedNotes, oldIndex, newIndex);

        const reorderedUnpinnedNotes = assignOrdersAfterUnpinnedReorder(
          newUnpinnedNotes,
          pinnedNotes.length,
        );

        const newNotes = [...pinnedNotes, ...reorderedUnpinnedNotes];
        const action = reorderNotes({ notes: newNotes });

        toast.promise(action, {
          loading: t('common.actions.loading'),
          success: t('common.notes.notesReordered'),
          error: t('common.notes.errors.failedToReorderNotes'),
        });

        await action;
        await refetch();
      }
    }

    setActiveId(null);
  };

  const filteredNotes = useMemo(
    () => notes.filter((note) => note.content.toLowerCase().includes(searchQuery.toLowerCase())),
    [notes, searchQuery],
  );

  const pinnedNotes = useMemo(() => filteredNotes.filter((note) => note.isPinned), [filteredNotes]);

  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((note) => !note.isPinned),
    [filteredNotes],
  );

  const sortedPinnedNotes = useMemo(() => sortNotesByOrder(pinnedNotes), [pinnedNotes]);

  const sortedUnpinnedNotes = useMemo(() => sortNotesByOrder(unpinnedNotes), [unpinnedNotes]);

  const pinnedIds = useMemo(() => sortedPinnedNotes.map((note) => note.id), [sortedPinnedNotes]);

  const unpinnedIds = useMemo(
    () => sortedUnpinnedNotes.map((note) => note.id),
    [sortedUnpinnedNotes],
  );

  return (
    <div className="relative" ref={panelRef}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'bg-popover inline-flex h-7 w-7 items-center justify-center gap-1 overflow-hidden rounded-md',
              notes.length > 0 && 'text-amber-500',
              isOpen && 'bg-accent',
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <StickyNote
              className={cn(
                'h-4 w-4',
                notes.length > 0 ? 'fill-amber-200 dark:fill-amber-900' : 'text-muted-foreground',
              )}
            />
            {notes.length > 0 && (
              <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px]">
                {notes.length}
              </span>
            )}
            <span className="sr-only">{t('common.notes.title')}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{t('common.notes.noteCount', { count: notes.length })}</p>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <div
          className="animate-in fade-in-20 zoom-in-95 bg-panel fixed right-0 top-[5rem] z-50 h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)] w-full max-w-[100vw] overflow-hidden rounded-t-lg border border-t shadow-lg duration-100 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:h-auto sm:max-h-[80vh] sm:w-[400px] sm:max-w-[90vw] sm:rounded-xl sm:border"
          onClick={handlePanelClick}
        >
          <div className="border-muted sticky top-0 z-10 flex items-center justify-between border-b p-3">
            <h3 className="flex items-center text-sm font-medium">
              <StickyNote className="mr-2 h-4 w-4" />
              {t('common.notes.title')}{' '}
              {notes.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {notes.length}
                </Badge>
              )}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-md p-0 hover:bg-white/10"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4 fill-[#9A9A9A]" />
              <span className="sr-only">{t('common.actions.close')}</span>
            </Button>
          </div>

          {notes.length > 0 && (
            <div className="sticky top-[49px] z-10 px-3 pb-0 pt-2">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
                <Input
                  placeholder={t('common.notes.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ring-offset-panel pl-8 text-sm focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex h-full flex-col sm:max-h-[calc(80vh-100px)]">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-3">
                  {notes.length === 0 && !isAddingNewNote ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <StickyNote className="text-muted-foreground mb-2 h-12 w-12" />
                      <p className="text-sm">{t('common.notes.empty')}</p>
                      <p className="text-muted-foreground mb-4 mt-1 max-w-[80%] text-xs">
                        {t('common.notes.emptyDescription')}
                      </p>
                      <Button variant="default" size="sm" onClick={() => setIsAddingNewNote(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        {t('common.notes.addNote')}
                      </Button>
                    </div>
                  ) : (
                    <>
                      {searchQuery && filteredNotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <AlertCircle className="text-muted-foreground mb-2 h-10 w-10 opacity-50" />
                          <p className="text-sm">
                            {t('common.notes.noMatchingNotes', { query: searchQuery })}
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mt-4"
                            onClick={() => setSearchQuery('')}
                          >
                            {t('common.notes.clearSearch')}
                          </Button>
                        </div>
                      ) : (
                        <>
                          {sortedPinnedNotes.length > 0 && (
                            <div className="mb-3">
                              <div className="mb-2 flex items-center">
                                <Pin className="mr-1 h-3 w-3 text-amber-500" />
                                <span className="text-muted-foreground text-xs font-medium">
                                  {t('common.notes.pinnedNotes')}
                                </span>
                              </div>

                              <SortableContext
                                items={pinnedIds}
                                strategy={verticalListSortingStrategy}
                              >
                                {sortedPinnedNotes.map((note) => (
                                  <SortableNote
                                    key={note.id}
                                    note={note}
                                    onEdit={() => startEditing(note)}
                                    onCopy={() => handleCopyNote(note.content)}
                                    onTogglePin={() => togglePinNote(note.id, !!note.isPinned)}
                                    onDelete={() => confirmDeleteNote(note.id)}
                                    onColorChange={(color) => handleChangeNoteColor(note.id, color)}
                                  />
                                ))}
                              </SortableContext>
                            </div>
                          )}

                          {sortedUnpinnedNotes.length > 0 && (
                            <div>
                              {sortedPinnedNotes.length > 0 && sortedUnpinnedNotes.length > 0 && (
                                <div className="mb-2 flex items-center">
                                  <span className="text-muted-foreground text-xs font-medium">
                                    {t('common.notes.otherNotes')}
                                  </span>
                                </div>
                              )}

                              <SortableContext
                                items={unpinnedIds}
                                strategy={verticalListSortingStrategy}
                              >
                                {sortedUnpinnedNotes.map((note) => (
                                  <SortableNote
                                    key={note.id}
                                    note={note}
                                    onEdit={() => startEditing(note)}
                                    onCopy={() => handleCopyNote(note.content)}
                                    onTogglePin={() => togglePinNote(note.id, !!note.isPinned)}
                                    onDelete={() => confirmDeleteNote(note.id)}
                                    onColorChange={(color) => handleChangeNoteColor(note.id, color)}
                                  />
                                ))}
                              </SortableContext>
                            </div>
                          )}
                        </>
                      )}

                      {isAddingNewNote && (
                        <div className="relative mb-3 overflow-hidden rounded-md border p-3">
                          <div
                            className={cn(
                              'absolute bottom-0 left-0 top-0 w-1.5 border-l-4',
                              selectedColor !== 'default'
                                ? getNoteColorClass(selectedColor)
                                : 'border-transparent',
                            )}
                            style={
                              selectedColor !== 'default' ? getNoteColorStyle(selectedColor) : {}
                            }
                          />

                          <div className="pl-1.5">
                            <Textarea
                              ref={textareaRef}
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, 'add')}
                              className="min-h-[120px] resize-none border-none bg-transparent focus:outline-none"
                              placeholder={t('common.notes.addYourNote')}
                            />

                            <div className="mt-2 flex flex-wrap items-center justify-between gap-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[#8C8C8C]">
                                  {t('common.notes.label')}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {NOTE_COLORS.map((color) => (
                                    <Tooltip key={color.value}>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => setSelectedColor(color.value)}
                                          className={cn(
                                            'h-5 w-5 rounded-full transition-all',
                                            color.value === 'default' ? 'bg-background border' : '',
                                            color.value === 'red' ? 'bg-red-500' : '',
                                            color.value === 'orange' ? 'bg-orange-500' : '',
                                            color.value === 'yellow' ? 'bg-amber-500' : '',
                                            color.value === 'green' ? 'bg-green-500' : '',
                                            color.value === 'blue' ? 'bg-blue-500' : '',
                                            color.value === 'purple' ? 'bg-purple-500' : '',
                                            color.value === 'pink' ? 'bg-pink-500' : '',
                                            selectedColor === color.value &&
                                              'ring-primary ring-2 ring-offset-1',
                                          )}
                                          aria-label={t(
                                            `common.notes.colors.${color.value}` as any,
                                          )}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="bottom"
                                        className="bg-white dark:bg-[#313131]"
                                      >
                                        {t(`common.notes.colors.${color.value}` as any)}
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              </div>

                              <div className="text-muted-foreground flex items-center text-xs">
                                <kbd className="bg-muted inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px]">
                                  {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
                                </kbd>
                                <span className="ml-1">{t('common.notes.toSave')}</span>
                              </div>
                            </div>

                            <div className="mt-3 flex justify-between">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setIsAddingNewNote(false);
                                  setNewNoteContent('');
                                }}
                              >
                                {t('common.notes.cancel')}
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => void handleAddNote()}
                                disabled={!newNoteContent.trim()}
                              >
                                {t('common.notes.save')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isAddingNewNote && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="mt-1 w-full"
                          onClick={() => setIsAddingNewNote(true)}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          {t('common.notes.addNote')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              <DragOverlay>
                {activeId ? (
                  <div className="bg-popover text-popover-foreground rounded-md p-3 pl-7 shadow-md">
                    <div className="pl-1.5">
                      <div className="whitespace-pre-wrap break-words text-sm">
                        {notes.find((n) => n.id === activeId)?.content}
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {editingNoteId && (
              <div className="border-muted border-t p-3">
                <div className="space-y-2">
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {t('common.notes.editNote')}:
                  </div>
                  <Textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'edit')}
                    className="min-h-[100px] resize-none text-sm"
                    placeholder={t('common.notes.addYourNote')}
                  />

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditContent('');
                      }}
                    >
                      {t('common.notes.cancel')}
                    </Button>
                    <Button variant="default" size="sm" onClick={() => void handleEditNote()}>
                      {t('common.actions.saveChanges')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
