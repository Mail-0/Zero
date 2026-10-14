import { isSyntheticLabel } from './mail-label-policy';

type Value = string | number | null;
type Row = Record<string, Value>;

export interface LabelStorage {
  exec(query: string, ...args: Value[]): Iterable<Row>;
  transaction(fn: () => void): void;
}

export interface LabelBatch {
  ids: string[];
  addLabelIds: string[];
  removeLabelIds: string[];
  operations: {
    messageId: string;
    labelId: string;
    version: string;
    desired: number;
    attempts: number;
  }[];
}

export class MailLabelStore {
  constructor(private storage: LabelStorage) {}

  initialize() {
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_thread_synthetic_labels (
      thread_id TEXT PRIMARY KEY, labels TEXT NOT NULL
    )`);
    // Labels the app keeps for a thread when the provider can't store them (Outlook,
    // IMAP servers without custom keywords). Merged into threadLabels() so re-imports
    // and provider label deltas never wipe them.
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_thread_app_labels (
      thread_id TEXT NOT NULL, label_id TEXT NOT NULL, PRIMARY KEY (thread_id, label_id)
    )`);
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_message_labels (
      message_id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, provider_labels TEXT NOT NULL
    )`);
    this.storage.exec(
      'CREATE INDEX IF NOT EXISTS mail_message_thread ON mail_message_labels(thread_id)',
    );
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_label_outbox (
      message_id TEXT PRIMARY KEY, version TEXT NOT NULL, desired INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL,
      blocked INTEGER NOT NULL DEFAULT 0, last_error TEXT, delivered INTEGER NOT NULL DEFAULT 0
    )`);
    if (
      ![...this.storage.exec('PRAGMA table_info(mail_label_outbox)')].some(
        (row) => row.name === 'delivered',
      )
    ) {
      this.storage.exec(
        'ALTER TABLE mail_label_outbox ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0',
      );
    }
    this.storage.exec(`CREATE TABLE IF NOT EXISTS mail_label_intents (
      message_id TEXT NOT NULL, label_id TEXT NOT NULL, version TEXT NOT NULL,
      desired INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL, blocked INTEGER NOT NULL DEFAULT 0,
      last_error TEXT, delivered INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(message_id, label_id)
    )`);
    // Preserve pending unread operations from earlier deployments. Keep the old
    // table empty for compatibility; never overwrite a newer general-label intent.
    this.storage.transaction(() => {
      this.storage.exec(`INSERT OR IGNORE INTO mail_label_intents
        SELECT message_id, 'UNREAD', version, desired, attempts, next_attempt_at, blocked, last_error, delivered
        FROM mail_label_outbox`);
      this.storage.exec('DELETE FROM mail_label_outbox');
    });
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_deleted_messages (message_id TEXT PRIMARY KEY)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_deleted_threads (thread_id TEXT PRIMARY KEY)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_message_checkpoints (message_id TEXT PRIMARY KEY, history_id TEXT NOT NULL)',
    );
    this.storage.exec(
      'CREATE INDEX IF NOT EXISTS mail_label_intents_due ON mail_label_intents(blocked, delivered, next_attempt_at)',
    );
    this.storage.exec(
      'CREATE TABLE IF NOT EXISTS mail_label_dispatch (id INTEGER PRIMARY KEY, not_before INTEGER NOT NULL)',
    );
    // Empty rows also mark migrated threads, preventing a stale SQL summary
    // from resurrecting a synthetic label after an explicit removal.
    if (
      [...this.storage.exec('PRAGMA table_info(threads)')].some(
        (row) => row.name === 'latest_label_ids',
      )
    ) {
      // Bulk-import only rows not yet migrated. Avoid a per-thread SQLite RPC
      // fan-out every time an alarm reconstructs a mailbox at scale.
      this.storage.exec(`INSERT OR IGNORE INTO mail_thread_synthetic_labels(thread_id, labels)
        SELECT t.thread_id, (SELECT json_group_array(value) FROM json_each(
          CASE WHEN json_valid(t.latest_label_ids) THEN t.latest_label_ids ELSE '[]' END
        ) WHERE value IN ('SNOOZED', 'MUTE'))
        FROM threads t WHERE NOT EXISTS (SELECT 1 FROM mail_deleted_threads d WHERE d.thread_id = t.thread_id)
        AND NOT EXISTS (
          SELECT 1 FROM mail_thread_synthetic_labels s WHERE s.thread_id = t.thread_id
        )`);
    }
  }

  importMessages(
    threadId: string,
    messages: { id: string; labels: string[] }[],
    historyId?: string,
    confirmedSnapshot = false,
  ) {
    this.storage.transaction(() => {
      this.storage.exec('DELETE FROM mail_deleted_threads WHERE thread_id = ?', threadId);
      if (confirmedSnapshot && historyId) {
        const present = new Set(messages.map((message) => message.id));
        for (const row of [
          ...this.storage.exec(
            'SELECT message_id FROM mail_message_labels WHERE thread_id = ?',
            threadId,
          ),
        ]) {
          const id = String(row.message_id);
          if (!present.has(id) && this.acceptHistory(id, historyId))
            this.deleteMessage(id, messages.length > 0);
        }
      }
      for (const message of messages) {
        if (this.isDeleted(message.id)) continue;
        if (!this.acceptHistory(message.id, historyId)) continue;
        this.storage.exec(
          `INSERT INTO mail_message_labels VALUES (?, ?, ?)
          ON CONFLICT(message_id) DO UPDATE SET provider_labels = excluded.provider_labels`,
          message.id,
          threadId,
          JSON.stringify(message.labels.filter((label) => !isSyntheticLabel(label))),
        );
        if (confirmedSnapshot)
          this.storage.exec(
            'DELETE FROM mail_label_intents WHERE message_id = ? AND delivered = 1',
            message.id,
          );
      }
    });
  }

  setUnread(threadId: string, unread: boolean, now: number, updateSummary: () => void = () => {}) {
    return this.setThreadLabels(
      [threadId],
      unread ? ['UNREAD'] : [],
      unread ? [] : ['UNREAD'],
      now,
      updateSummary,
    );
  }

  setThreadLabels(
    threadIds: string[],
    add: string[],
    remove: string[],
    now: number,
    updateSummary: () => void = () => {},
  ) {
    if ([...add, ...remove].some(isSyntheticLabel)) {
      throw new Error('Synthetic labels must use setSyntheticThreadLabels');
    }
    const desired = new Map<string, number>(remove.map((label) => [label, 0]));
    for (const label of add) desired.set(label, 1);
    this.storage.transaction(() => {
      for (const threadId of new Set(threadIds)) {
        const messages = [
          ...this.storage.exec(
            'SELECT message_id, provider_labels FROM mail_message_labels WHERE thread_id = ?',
            threadId,
          ),
        ];
        if (!messages.length) throw new Error(`Thread ${threadId} has no stored messages`);
        for (const message of messages) {
          const labels = JSON.parse(String(message.provider_labels)) as string[];
          if (labels.includes('DRAFT')) continue;
          for (const [labelId, present] of desired) {
            const pending = [
              ...this.storage.exec(
                'SELECT version, desired FROM mail_label_intents WHERE message_id = ? AND label_id = ?',
                message.message_id,
                labelId,
              ),
            ][0];
            if (pending && Number(pending.desired) === present) continue;
            if (!pending && labels.includes(labelId) === Boolean(present)) continue;
            this.storage.exec(
              `INSERT INTO mail_label_intents(message_id, label_id, version, desired, next_attempt_at)
          VALUES (?, ?, ?, ?, ?) ON CONFLICT(message_id, label_id) DO UPDATE SET
          version = excluded.version, desired = excluded.desired, attempts = 0,
          next_attempt_at = excluded.next_attempt_at, blocked = 0, last_error = NULL, delivered = 0`,
              message.message_id,
              labelId,
              crypto.randomUUID(),
              present,
              now + 1000,
            );
          }
        }
      }
      updateSummary();
    });
  }

  messageLabels(messageId: string): string[] | undefined {
    const row = [
      ...this.storage.exec(
        'SELECT provider_labels FROM mail_message_labels WHERE message_id = ?',
        messageId,
      ),
    ][0];
    if (!row) return undefined;
    const labels = (JSON.parse(String(row.provider_labels)) as string[]).filter(
      (label) => !isSyntheticLabel(label),
    );
    return this.overlayLabels(messageId, labels);
  }

  private overlayLabels(messageId: string, labels: string[]) {
    const effective = new Set(labels);
    for (const intent of this.storage.exec(
      'SELECT label_id, desired FROM mail_label_intents WHERE message_id = ?',
      messageId,
    )) {
      if (intent.desired) effective.add(String(intent.label_id));
      else effective.delete(String(intent.label_id));
    }
    return [...effective];
  }

  /**
   * Effective per-message labels for those of `threadIds` that still have local
   * label intents the provider may not reflect yet. Threads without intents are
   * omitted: their provider state is authoritative.
   */
  pendingThreadMessageLabels(threadIds: string[]): Map<string, string[][]> {
    const wanted = new Set(threadIds);
    const result = new Map<string, string[][]>();
    if (!wanted.size) return result;
    for (const row of [
      ...this.storage.exec(
        `SELECT DISTINCT m.thread_id FROM mail_label_intents i
         JOIN mail_message_labels m ON m.message_id = i.message_id`,
      ),
    ]) {
      const threadId = String(row.thread_id);
      if (!wanted.has(threadId)) continue;
      const messages: string[][] = [];
      for (const message of [
        ...this.storage.exec(
          'SELECT message_id FROM mail_message_labels WHERE thread_id = ?',
          threadId,
        ),
      ]) {
        const labels = this.messageLabels(String(message.message_id));
        if (labels) messages.push(labels);
      }
      result.set(threadId, messages);
    }
    return result;
  }

  threadLabels(threadId: string): string[] {
    const labels = new Set<string>([
      ...this.getSyntheticThreadLabels(threadId),
      ...this.appThreadLabels(threadId),
    ]);
    const messages = new Map<string, Set<string>>();
    for (const row of this.storage.exec(
      `SELECT m.message_id, m.provider_labels, i.label_id, i.desired FROM mail_message_labels m
       LEFT JOIN mail_label_intents i ON i.message_id = m.message_id WHERE m.thread_id = ?`,
      threadId,
    )) {
      const id = String(row.message_id);
      const effective =
        messages.get(id) ?? new Set<string>(JSON.parse(String(row.provider_labels)));
      if (row.label_id !== null) {
        if (row.desired) effective.add(String(row.label_id));
        else effective.delete(String(row.label_id));
      }
      messages.set(id, effective);
    }
    for (const effective of messages.values()) {
      if (!effective.has('DRAFT'))
        for (const label of effective) if (!isSyntheticLabel(label)) labels.add(label);
    }
    return [...labels];
  }

  importSyntheticThreadLabels(threadId: string, legacyLabels: string | string[]) {
    if (this.isThreadDeleted(threadId)) return;
    let labels: unknown = legacyLabels;
    if (typeof labels === 'string') {
      try {
        labels = JSON.parse(labels);
      } catch {
        return;
      }
    }
    if (!Array.isArray(labels)) return;
    this.storage.exec(
      'INSERT OR IGNORE INTO mail_thread_synthetic_labels VALUES (?, ?)',
      threadId,
      JSON.stringify(
        labels.filter((label) => typeof label === 'string' && isSyntheticLabel(label)),
      ),
    );
  }

  getSyntheticThreadLabels(threadId: string): string[] {
    const row = [
      ...this.storage.exec(
        'SELECT labels FROM mail_thread_synthetic_labels WHERE thread_id = ?',
        threadId,
      ),
    ][0];
    return row ? (JSON.parse(String(row.labels)) as string[]) : [];
  }

  setSyntheticThreadLabels(threadId: string, add: string[], remove: string[]) {
    if (![...add, ...remove].every(isSyntheticLabel)) throw new Error('Unknown synthetic label');
    this.storage.exec(
      `INSERT INTO mail_thread_synthetic_labels VALUES (?, ?) ON CONFLICT(thread_id)
       DO UPDATE SET labels = excluded.labels`,
      threadId,
      JSON.stringify(updateLabels(this.getSyntheticThreadLabels(threadId), add, remove)),
    );
  }

  removeSyntheticThreadLabels(threadId: string) {
    this.storage.exec('DELETE FROM mail_thread_synthetic_labels WHERE thread_id = ?', threadId);
    this.storage.exec('DELETE FROM mail_thread_app_labels WHERE thread_id = ?', threadId);
  }

  appThreadLabels(threadId: string): string[] {
    return [
      ...this.storage.exec(
        'SELECT label_id FROM mail_thread_app_labels WHERE thread_id = ? ORDER BY label_id',
        threadId,
      ),
    ].map((row) => String(row.label_id));
  }

  /** Adds/removes app-kept labels on a thread. Removal also clears labels added elsewhere. */
  setAppThreadLabels(threadId: string, add: string[], remove: string[]) {
    this.storage.transaction(() => {
      for (const label of remove)
        this.storage.exec(
          'DELETE FROM mail_thread_app_labels WHERE thread_id = ? AND label_id = ?',
          threadId,
          label,
        );
      for (const label of add)
        if (!remove.includes(label))
          this.storage.exec(
            'INSERT OR IGNORE INTO mail_thread_app_labels VALUES (?, ?)',
            threadId,
            label,
          );
    });
  }

  /** Drops an app-kept label from every thread (the label was deleted). */
  forgetAppLabel(labelId: string) {
    this.storage.exec('DELETE FROM mail_thread_app_labels WHERE label_id = ?', labelId);
  }

  applyProviderLabels(messageId: string, add: string[], remove: string[], historyId?: string) {
    const row = [
      ...this.storage.exec(
        'SELECT provider_labels, thread_id FROM mail_message_labels WHERE message_id = ?',
        messageId,
      ),
    ][0];
    if (!row) return undefined;
    if (!this.acceptHistory(messageId, historyId)) return String(row.thread_id);
    this.storage.exec(
      'UPDATE mail_message_labels SET provider_labels = ? WHERE message_id = ?',
      JSON.stringify(updateLabels(JSON.parse(String(row.provider_labels)), add, remove)),
      messageId,
    );
    const labels = updateLabels(JSON.parse(String(row.provider_labels)), add, remove);
    for (const intent of [
      ...this.storage.exec(
        'SELECT label_id, desired, version FROM mail_label_intents WHERE message_id = ? AND delivered = 1',
        messageId,
      ),
    ]) {
      const labelId = String(intent.label_id);
      if (
        (add.includes(labelId) || remove.includes(labelId)) &&
        labels.includes(labelId) === Boolean(intent.desired)
      ) {
        this.storage.exec(
          'DELETE FROM mail_label_intents WHERE message_id = ? AND label_id = ? AND version = ?',
          messageId,
          intent.label_id,
          intent.version,
        );
      }
    }
    return String(row.thread_id);
  }

  private acceptHistory(messageId: string, historyId?: string) {
    if (!historyId) return true;
    const checkpoint = [
      ...this.storage.exec(
        'SELECT history_id FROM mail_message_checkpoints WHERE message_id = ?',
        messageId,
      ),
    ][0];
    if (checkpoint && BigInt(String(checkpoint.history_id)) > BigInt(historyId)) return false;
    this.storage.exec(
      `INSERT INTO mail_message_checkpoints VALUES (?, ?) ON CONFLICT(message_id)
      DO UPDATE SET history_id = excluded.history_id`,
      messageId,
      historyId,
    );
    return true;
  }

  deleteMessage(messageId: string, preserveSynthetic = false) {
    const row = [
      ...this.storage.exec(
        'SELECT thread_id FROM mail_message_labels WHERE message_id = ?',
        messageId,
      ),
    ][0];
    this.storage.exec('INSERT OR IGNORE INTO mail_deleted_messages VALUES (?)', messageId);
    this.storage.exec('DELETE FROM mail_label_intents WHERE message_id = ?', messageId);
    this.storage.exec('DELETE FROM mail_message_labels WHERE message_id = ?', messageId);
    if (
      row &&
      !preserveSynthetic &&
      ![
        ...this.storage.exec(
          'SELECT message_id FROM mail_message_labels WHERE thread_id = ? LIMIT 1',
          row.thread_id,
        ),
      ].length
    ) {
      this.removeSyntheticThreadLabels(String(row.thread_id));
      this.storage.exec('INSERT OR IGNORE INTO mail_deleted_threads VALUES (?)', row.thread_id);
    }
    return row ? String(row.thread_id) : undefined;
  }

  isDeleted(messageId: string) {
    return (
      [
        ...this.storage.exec(
          'SELECT message_id FROM mail_deleted_messages WHERE message_id = ?',
          messageId,
        ),
      ].length > 0
    );
  }

  removeThread(threadId: string) {
    this.removeSyntheticThreadLabels(threadId);
    this.storage.exec('INSERT OR IGNORE INTO mail_deleted_threads VALUES (?)', threadId);
    for (const row of [
      ...this.storage.exec(
        'SELECT message_id FROM mail_message_labels WHERE thread_id = ?',
        threadId,
      ),
    ]) {
      this.deleteMessage(String(row.message_id));
    }
  }

  isThreadDeleted(threadId: string) {
    return (
      [
        ...this.storage.exec(
          'SELECT thread_id FROM mail_deleted_threads WHERE thread_id = ?',
          threadId,
        ),
      ].length > 0
    );
  }

  pendingBatches(now: number): LabelBatch[] {
    const dispatch = [
      ...this.storage.exec('SELECT not_before FROM mail_label_dispatch WHERE id = 1'),
    ][0];
    if (dispatch && Number(dispatch.not_before) > now) return [];
    const rows = [
      ...this.storage.exec(
        `SELECT * FROM mail_label_intents WHERE blocked = 0 AND delivered = 0
      AND next_attempt_at <= ? ORDER BY next_attempt_at, message_id, label_id LIMIT 10000`,
        now,
      ),
    ];
    const messages = new Map<string, LabelBatch['operations']>();
    for (const row of rows) {
      const messageId = String(row.message_id);
      const operations = messages.get(messageId) ?? [];
      // Gmail accepts at most 100 additions and 100 removals per modification.
      if (operations.filter((op) => op.desired === Number(row.desired)).length >= 100) continue;
      operations.push({
        messageId,
        labelId: String(row.label_id),
        version: String(row.version),
        desired: Number(row.desired),
        attempts: Number(row.attempts),
      });
      messages.set(messageId, operations);
    }
    const batches: LabelBatch[] = [];
    const groups = new Map<string, LabelBatch>();
    for (const [messageId, operations] of messages) {
      const addLabelIds = operations
        .filter((op) => op.desired)
        .map((op) => op.labelId)
        .sort();
      const removeLabelIds = operations
        .filter((op) => !op.desired)
        .map((op) => op.labelId)
        .sort();
      const signature = JSON.stringify([addLabelIds, removeLabelIds]);
      let batch = groups.get(signature);
      if (!batch || batch.ids.length === 1000) {
        batch = { ids: [], addLabelIds, removeLabelIds, operations: [] };
        batches.push(batch);
        groups.set(signature, batch);
      }
      batch.ids.push(messageId);
      batch.operations.push(...operations);
    }
    return batches;
  }

  acknowledge(batch: LabelBatch) {
    this.storage.transaction(() => {
      for (const operation of batch.operations) {
        this.storage.exec(
          'UPDATE mail_label_intents SET delivered = 1 WHERE message_id = ? AND label_id = ? AND version = ?',
          operation.messageId,
          operation.labelId,
          operation.version,
        );
        // Cached provider state can predate an earlier write (e.g. INBOX before
        // trash). Only subsequent matching history or a fresh snapshot confirms
        // delivery; an HTTP acknowledgment alone cannot clear the overlay.
      }
    });
  }

  defer(
    batch: LabelBatch,
    nextAttemptAt: number,
    error: string,
    blocked: boolean,
    countAttempt = true,
  ) {
    for (const operation of batch.operations) {
      this.storage.exec(
        `UPDATE mail_label_intents SET attempts = attempts + ?,
        next_attempt_at = ?, last_error = ?, blocked = ? WHERE message_id = ? AND label_id = ? AND version = ?`,
        Number(countAttempt),
        nextAttemptAt,
        error,
        Number(blocked),
        operation.messageId,
        operation.labelId,
        operation.version,
      );
    }
  }

  nextAttempt(): number | undefined {
    const row = [
      ...this.storage.exec(
        'SELECT MIN(next_attempt_at) AS due FROM mail_label_intents WHERE blocked = 0 AND delivered = 0',
      ),
    ][0];
    if (row?.due === null || !row) return undefined;
    const dispatch = [
      ...this.storage.exec('SELECT not_before FROM mail_label_dispatch WHERE id = 1'),
    ][0];
    return Math.max(Number(row.due), Number(dispatch?.not_before ?? 0));
  }

  delayDispatch(until: number) {
    this.storage.exec(
      `INSERT INTO mail_label_dispatch VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET not_before = MAX(not_before, excluded.not_before)`,
      until,
    );
  }

  status() {
    return [
      ...this.storage
        .exec(`SELECT blocked, delivered, COUNT(*) AS count, MAX(last_error) AS last_error
      FROM mail_label_intents GROUP BY blocked, delivered`),
    ];
  }

  retryBlocked(now: number) {
    this.storage.exec(
      'UPDATE mail_label_intents SET blocked = 0, next_attempt_at = ?, attempts = 0 WHERE blocked = 1',
      now,
    );
  }
}

function updateLabels(labels: string[], add: string[], remove: string[]) {
  return [...new Set([...labels.filter((label) => !remove.includes(label)), ...add])];
}
