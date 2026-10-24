import type { LabelStorage } from './mail-label-store';
import type { Sender } from '../types';
import { z } from 'zod';

type ContactMessage = { sender: Sender; to: Sender[]; cc: Sender[] | null; bcc?: Sender[] | null };
const contactSchema = z.object({ email: z.string().trim().email(), name: z.string().optional() });
const contactMessageSchema = z.object({
  sender: contactSchema,
  to: z.array(contactSchema).default([]),
  cc: z.array(contactSchema).nullable().default([]),
});

/** Each store belongs to a single mailbox Durable Object; no account IDs are accepted here. */
export class MailContactStore {
  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_known_contacts (email TEXT PRIMARY KEY, name TEXT NOT NULL)',
    );
    this.storage.exec(
      "CREATE TABLE IF NOT EXISTS mail_contacts_backfill (id INTEGER PRIMARY KEY, cursor TEXT NOT NULL DEFAULT '', complete INTEGER NOT NULL DEFAULT 0)",
    );
    this.storage.exec('INSERT OR IGNORE INTO mail_contacts_backfill (id) VALUES (1)');
  }

  observe(messages: ContactMessage[]) {
    for (const message of messages) {
      for (const value of [message.sender, ...message.to, ...(message.cc ?? [])]) {
        const parsed = contactSchema.safeParse(value);
        if (!parsed.success) continue;
        this.storage.exec(
          `INSERT INTO mail_known_contacts (email, name) VALUES (?, ?)
          ON CONFLICT(email) DO UPDATE SET name = CASE WHEN excluded.name != '' THEN excluded.name ELSE mail_known_contacts.name END`,
          parsed.data.email.toLowerCase(),
          parsed.data.name?.trim() ?? '',
        );
      }
    }
  }

  backfill(batchSize = 200) {
    const [state] = [
      ...this.storage.exec('SELECT cursor, complete FROM mail_contacts_backfill WHERE id = 1'),
    ];
    if (state?.complete) return true;
    const rows = [
      ...this.storage.exec(
        'SELECT thread_id, summary_json FROM threads WHERE thread_id > ? ORDER BY thread_id LIMIT ?',
        String(state?.cursor ?? ''),
        batchSize,
      ),
    ];
    for (const row of rows) {
      try {
        const summary = JSON.parse(String(row.summary_json));
        const parsed = contactMessageSchema.safeParse(summary?.latest);
        if (parsed.success) this.observe([parsed.data]);
      } catch {
        /* Old or absent snapshots do not prove the contact is absent. */
      }
    }
    const complete = rows.length < batchSize;
    this.storage.exec(
      'UPDATE mail_contacts_backfill SET cursor = ?, complete = ? WHERE id = 1',
      rows.length ? String(rows[rows.length - 1]!.thread_id) : String(state?.cursor ?? ''),
      Number(complete),
    );
    return complete;
  }

  search(query: string, limit: number) {
    const pattern = `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`;
    const rows = [
      ...this.storage.exec(
        `SELECT email, name FROM mail_known_contacts
      WHERE email LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'
      ORDER BY email LIMIT ?`,
        pattern,
        pattern,
        limit + 1,
      ),
    ];
    return {
      contacts: rows.slice(0, limit).map((row) => ({
        email: String(row.email),
        ...(row.name ? { name: String(row.name) } : {}),
      })),
      hasMore: rows.length > limit,
    };
  }
}
