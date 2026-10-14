import type { Message } from 'ai';

/**
 * Past AI chat conversations for one mailbox, stored in the ZeroAgent's SQLite.
 *
 * The framework (AIChatAgent) keeps the *open* conversation in
 * `cf_ai_chat_agent_messages`; this store mirrors it into `chat_conversations`
 * on every save and tracks which conversation that is, so "new chat" archives
 * instead of deleting and old chats can be reopened.
 */

type Sql = <T = Record<string, string | number | boolean | null>>(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null)[]
) => T[];

export type ConversationSummary = { id: string; title: string; updatedAt: number };

export const MAX_CONVERSATIONS = 100;
const TITLE_MAX_CHARS = 80;

export class ConversationStore {
  constructor(private readonly sql: Sql) {
    void this.sql`create table if not exists chat_conversations (
      id text primary key,
      title text not null,
      created_at integer not null,
      updated_at integer not null,
      messages text not null
    )`;
    void this
      .sql`create table if not exists chat_state (key text primary key, value text not null)`;
  }

  getState(key: string): string | undefined {
    return this.sql<{ value: string }>`select value from chat_state where key = ${key}`[0]?.value;
  }

  setState(key: string, value: string) {
    void this.sql`insert into chat_state (key, value) values (${key}, ${value})
      on conflict(key) do update set value = excluded.value`;
  }

  /** The open conversation's id, created on first use. */
  currentId(): string {
    const existing = this.getState('current_conversation');
    if (existing) return existing;
    const id = crypto.randomUUID();
    this.setState('current_conversation', id);
    return id;
  }

  startNew(): string {
    const id = crypto.randomUUID();
    this.setState('current_conversation', id);
    return id;
  }

  setCurrent(id: string) {
    this.setState('current_conversation', id);
  }

  /** Upserts a conversation. Returns the messages JSON of any conversations pruned over the cap. */
  save(id: string, messages: Message[]): string[] {
    if (messages.length === 0) return [];
    const now = Date.now();
    const title = titleFor(messages);
    const json = JSON.stringify(messages);
    void this.sql`insert into chat_conversations (id, title, created_at, updated_at, messages)
      values (${id}, ${title}, ${now}, ${now}, ${json})
      on conflict(id) do update set
        messages = excluded.messages,
        updated_at = excluded.updated_at`;
    return this.prune();
  }

  list(): ConversationSummary[] {
    return this.sql<{ id: string; title: string; updated_at: number }>`
      select id, title, updated_at from chat_conversations order by updated_at desc limit ${MAX_CONVERSATIONS}`.map(
      (row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }),
    );
  }

  get(id: string): Message[] | undefined {
    const row = this.sql<{
      messages: string;
    }>`select messages from chat_conversations where id = ${id}`[0];
    return row ? (JSON.parse(row.messages) as Message[]) : undefined;
  }

  /** Returns the deleted conversation's messages JSON, for attachment cleanup. */
  delete(id: string): string | undefined {
    const row = this.sql<{
      messages: string;
    }>`select messages from chat_conversations where id = ${id}`[0];
    if (!row) return undefined;
    void this.sql`delete from chat_conversations where id = ${id}`;
    return row.messages;
  }

  /** Every stored conversation's messages JSON, for finding referenced attachments. */
  allMessagesJson(): string[] {
    return this.sql<{ messages: string }>`select messages from chat_conversations`.map(
      (r) => r.messages,
    );
  }

  deleteAll() {
    void this.sql`delete from chat_conversations`;
    void this.sql`delete from chat_state`;
  }

  private prune(): string[] {
    const overflow = this.sql<{ id: string; messages: string }>`
      select id, messages from chat_conversations order by updated_at desc limit -1 offset ${MAX_CONVERSATIONS}`;
    for (const row of overflow) void this.sql`delete from chat_conversations where id = ${row.id}`;
    return overflow.map((row) => row.messages);
  }
}

function titleFor(messages: Message[]): string {
  const first = messages.find((m) => m.role === 'user');
  const text = (first?.content ?? '').replace(/\s+/g, ' ').trim();
  if (text) return text.length > TITLE_MAX_CHARS ? `${text.slice(0, TITLE_MAX_CHARS - 1)}…` : text;
  const files = first?.experimental_attachments?.map((a) => a.name).filter(Boolean);
  return files?.length ? files.join(', ').slice(0, TITLE_MAX_CHARS) : 'New chat';
}
