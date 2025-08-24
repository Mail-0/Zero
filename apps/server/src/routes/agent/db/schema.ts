import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import type { Sender } from '../../../types';
import { relations } from 'drizzle-orm';

export const threads = sqliteTable(
  'threads',
  {
    id: text('id').notNull().primaryKey(),
    threadId: text('thread_id').notNull(),
    providerId: text('provider_id').notNull(),
    latestSender: text('latest_sender', { mode: 'json' }).$type<Sender>(),
    latestReceivedOn: text('latest_received_on'),
    latestSubject: text('latest_subject'),
  },
  (table) => [
    index('threads_thread_id_idx').on(table.threadId),
    index('threads_provider_id_idx').on(table.providerId),
    index('threads_latest_received_on_idx').on(table.latestReceivedOn),
    index('threads_latest_subject_idx').on(table.latestSubject),
    index('threads_latest_sender_idx').on(table.latestSender),
  ],
);

export const labels = sqliteTable(
  'labels',
  {
    id: text('id').notNull().primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (table) => [index('labels_name_idx').on(table.name)],
);

export const threadLabels = sqliteTable(
  'thread_labels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    threadId: text('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('thread_labels_thread_id_idx').on(table.threadId),
    index('thread_labels_label_id_idx').on(table.labelId),
    index('thread_labels_thread_label_idx').on(table.threadId, table.labelId),
    unique().on(table.threadId, table.labelId),
  ],
);

export const threadsRelations = relations(threads, ({ many }) => ({
  threadLabels: many(threadLabels),
}));

export const labelsRelations = relations(labels, ({ many }) => ({
  threadLabels: many(threadLabels),
}));

export const threadLabelsRelations = relations(threadLabels, ({ one }) => ({
  thread: one(threads, {
    fields: [threadLabels.threadId],
    references: [threads.id],
  }),
  label: one(labels, {
    fields: [threadLabels.labelId],
    references: [labels.id],
  }),
}));
