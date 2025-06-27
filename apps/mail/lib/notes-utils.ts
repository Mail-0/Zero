import type { Note } from '@/types';
import React from 'react';
import { formatDate } from './utils';

export const NOTE_COLORS = [
  { value: 'default', label: 'Default', class: 'border-transparent', bgClass: '', style: {} },
  {
    value: 'red',
    label: 'Red',
    class: 'border-l-red-500',
    bgClass: 'hover:bg-red-50 dark:hover:bg-red-950/20',
    style: { borderLeftColor: 'rgb(239, 68, 68)' },
  },
  {
    value: 'orange',
    label: 'Orange',
    class: 'border-l-orange-500',
    bgClass: 'hover:bg-orange-50 dark:hover:bg-orange-950/20',
    style: { borderLeftColor: 'rgb(249, 115, 22)' },
  },
  {
    value: 'yellow',
    label: 'Yellow',
    class: 'border-l-amber-500',
    bgClass: 'hover:bg-amber-50 dark:hover:bg-amber-950/20',
    style: { borderLeftColor: 'rgb(245, 158, 11)' },
  },
  {
    value: 'green',
    label: 'Green',
    class: 'border-l-green-500',
    bgClass: 'hover:bg-green-50 dark:hover:bg-green-950/20',
    style: { borderLeftColor: 'rgb(34, 197, 94)' },
  },
  {
    value: 'blue',
    label: 'Blue',
    class: 'border-l-blue-500',
    bgClass: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
    style: { borderLeftColor: 'rgb(59, 130, 246)' },
  },
  {
    value: 'purple',
    label: 'Purple',
    class: 'border-l-purple-500',
    bgClass: 'hover:bg-purple-50 dark:hover:bg-purple-950/20',
    style: { borderLeftColor: 'rgb(168, 85, 247)' },
  },
  {
    value: 'pink',
    label: 'Pink',
    class: 'border-l-pink-500',
    bgClass: 'hover:bg-pink-50 dark:hover:bg-pink-950/20',
    style: { borderLeftColor: 'rgb(236, 72, 153)' },
  },
];

export const NOTE_COLOR_TRANSLATION_KEYS: Record<string, string> = {
  default: 'common.notes.colors.default',
  red: 'common.notes.colors.red',
  orange: 'common.notes.colors.orange',
  yellow: 'common.notes.colors.yellow',
  green: 'common.notes.colors.green',
  blue: 'common.notes.colors.blue',
  purple: 'common.notes.colors.purple',
  pink: 'common.notes.colors.pink',
};

export function getNoteColorTranslationKey(colorValue: string): string {
  return NOTE_COLOR_TRANSLATION_KEYS[colorValue] || colorValue;
}

export function getNoteColorClass(color: string): string {
  const colorInfo = NOTE_COLORS.find((c) => c.value === color);
  return colorInfo?.class || 'border-transparent';
}

export function getNoteColorStyle(color: string): React.CSSProperties {
  const colorInfo = NOTE_COLORS.find((c) => c.value === color);
  return colorInfo?.style || {};
}

export function borderToBackgroundColorClass(borderClass: string): string {
  return borderClass.replace('border-l-', 'bg-');
}

export function formatRelativeTime(dateInput: string | Date, formatter?: any): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (formatter) {
    return formatter.relativeTime(date, {
      now,
      style: 'long',
    });
  }

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatDate(date, formatter);
  }
}


export function sortNotes(notes: Note[]): Note[] {
  const pinnedNotes = notes.filter((note) => note.isPinned);
  const unpinnedNotes = notes.filter((note) => !note.isPinned);

  const sortedPinnedNotes = sortNotesByOrder(pinnedNotes);
  const sortedUnpinnedNotes = sortNotesByOrder(unpinnedNotes);

  return [...sortedPinnedNotes, ...sortedUnpinnedNotes];
}

export function sortNotesByOrder(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (typeof a.order === 'number' && typeof b.order === 'number') {
      return a.order - b.order;
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function assignOrdersAfterPinnedReorder(notes: Note[]): Note[] {
  return notes.map((note, index) => ({
    ...note,
    order: index,
  }));
}

export function assignOrdersAfterUnpinnedReorder(notes: Note[], pinnedNotesCount: number): Note[] {
  return notes.map((note, index) => ({
    ...note,
    order: pinnedNotesCount + index,
  }));
}

export function updateNotesWithNewOrders(
  notes: Note[],
  updatedOrders: { id: string; order: number; isPinned?: boolean }[],
): Note[] {
  const updatedNotes = notes.map((note) => {
    const update = updatedOrders.find((update) => update.id === note.id);

    if (!update) {
      return note;
    }

    return {
      id: note.id,
      userId: note.userId,
      threadId: note.threadId,
      content: note.content,
      color: note.color,
      isPinned: update.isPinned !== undefined ? update.isPinned : note.isPinned,
      order: update.order,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  });

  return sortNotes(updatedNotes);
}
