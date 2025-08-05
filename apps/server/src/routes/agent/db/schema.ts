import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import type { Sender } from '../../../types';
import { relations } from 'drizzle-orm';

export const threads = sqliteTable('threads', {
  id: text('id').notNull().primaryKey(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  threadId: text('thread_id').notNull(),
  providerId: text('provider_id').notNull(),
  latestSender: text('latest_sender', { mode: 'json' }).$type<Sender>(),
  latestReceivedOn: text('latest_received_on'),
  latestSubject: text('latest_subject'),
  latestLabelIds: text('latest_label_ids', { mode: 'json' }).$type<string[]>(),
});

export const labels = sqliteTable('labels', {
  id: text('id').notNull().primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

export const threadLabels = sqliteTable('thread_labels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  threadId: text('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  labelId: text('label_id')
    .notNull()
    .references(() => labels.id, { onDelete: 'cascade' }),
});

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
