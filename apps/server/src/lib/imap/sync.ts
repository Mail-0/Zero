/**
 * Incremental IMAP mailbox sync into the ImapIndexStore.
 *
 * Every run (driven by the ZeroDriver alarm):
 *  1. Refreshes the folder list (periodically) and maps it to labels.
 *  2. For each folder, uses STATUS to skip unchanged folders cheaply.
 *  3. For changed folders, SELECTs (with QRESYNC when available) and applies:
 *     - new messages (UID >= stored UIDNEXT),
 *     - flag changes (QRESYNC/CONDSTORE CHANGEDSINCE, else a rescan of recent UIDs),
 *     - expunges (QRESYNC VANISHED, else a UID SEARCH diff),
 *     - UIDVALIDITY changes (folder rebuilt).
 *  4. Backfills older mail newest-first, bounded by age and count.
 *
 * Work per run is bounded by `budget` messages; the caller reschedules while `complete` is false.
 */
import { findSection, formatSearchDate, type FetchedMessage, type ImapClient } from './client';
import { headersFromBlock, type FolderState, type ImapIndexStore } from './imap-store';
import { folderSyncOrder, mapFolders, type MappedFolder } from './folders';
import { CATEGORY_HEADER_FIELDS } from './categorize';
import { toSequenceSet } from './parser';

export interface ImapSyncOptions {
  /** Only backfill mail newer than this many days. */
  backfillDays: number;
  /** Max messages kept per system folder / user folder by the backfill. */
  backfillLimitSystem: number;
  backfillLimitUser: number;
  /** Messages per FETCH. */
  batchSize: number;
  /** Max messages fetched per run across all folders. */
  budget: number;
  /** Recent UIDs re-checked for flag changes on servers without CONDSTORE. */
  flagRescanWindow: number;
  /** Refresh the folder list every N runs. */
  folderRefreshEvery: number;
}

export const defaultSyncOptions: ImapSyncOptions = {
  backfillDays: 90,
  backfillLimitSystem: 2000,
  backfillLimitUser: 500,
  batchSize: 100,
  budget: 400,
  flagRescanWindow: 300,
  folderRefreshEvery: 15,
};

/** Threading headers plus the ones the inbox categorizer reads. */
export const HEADER_FIELDS = `MESSAGE-ID IN-REPLY-TO REFERENCES SUBJECT DATE ${CATEGORY_HEADER_FIELDS}`;

/** Messages re-fetched per run to categorize mail indexed before categories existed. */
const CATEGORIZE_BACKFILL_BATCH = 200;

export interface SyncRunResult {
  complete: boolean;
  fetched: number;
  foldersChanged: string[];
}

const parseInternalDate = (value?: string) => {
  if (!value) return null;
  const parsed = Date.parse(value.replace(/^(\d{1,2})-(\w{3})-(\d{4})/, '$1 $2 $3'));
  return Number.isFinite(parsed) ? parsed : null;
};

export class ImapSyncEngine {
  private budget = 0;

  constructor(
    private store: ImapIndexStore,
    private options: ImapSyncOptions = defaultSyncOptions,
  ) {}

  private fetchItems(client: ImapClient) {
    const items = [
      'UID',
      'FLAGS',
      'INTERNALDATE',
      'RFC822.SIZE',
      `BODY.PEEK[HEADER.FIELDS (${HEADER_FIELDS})]`,
    ];
    if (client.has('CONDSTORE')) items.push('MODSEQ');
    return items;
  }

  /**
   * Applies fetched header records for a folder. With `live`, messages never seen before
   * that land in the inbox or a user folder are queued for the AI thread workflow (the
   * IMAP counterpart of Gmail's `messagesAdded` history). Sent, drafts, spam, trash and
   * archive are skipped, as are backfilled messages.
   */
  ingest(
    folder: string,
    uidValidity: number,
    messages: FetchedMessage[],
    { live = false }: { live?: boolean } = {},
  ) {
    const state = live ? this.store.folder(folder) : undefined;
    const liveFolder =
      !!state && !state.skip && (state.system === null || state.system === 'INBOX');
    for (const message of messages) {
      const header = findSection(message, 'BODY[HEADER');
      const flags = message.flags ?? [];
      const { threadId, created, category } = this.store.upsertMessage({
        folder,
        uidValidity,
        uid: message.uid,
        flags,
        modseq: message.modseq,
        size: message.size,
        internalDate: parseInternalDate(message.internalDate),
        headers: headersFromBlock(header ? new TextDecoder().decode(header) : ''),
      });
      // Promotions skip the AI workflow, like Gmail's CATEGORY_PROMOTIONS.
      if (
        liveFolder &&
        created &&
        category !== 'promotions' &&
        !flags.some((flag) => flag.toLowerCase() === '\\draft')
      )
        this.store.recordNewMail(threadId);
    }
  }

  async refreshFolders(client: ImapClient): Promise<MappedFolder[]> {
    const mapped = mapFolders(await client.list());
    const seen = new Set(mapped.map((folder) => folder.path));
    for (const folder of mapped) this.store.upsertFolder(folder);
    for (const known of this.store.folders()) {
      if (!seen.has(known.path)) this.store.resetFolder(known.path, { forget: true });
    }
    return mapped;
  }

  async run(client: ImapClient, { refreshFolders = false } = {}): Promise<SyncRunResult> {
    this.budget = this.options.budget;
    const result: SyncRunResult = { complete: true, fetched: 0, foldersChanged: [] };
    const known = this.store.folders();
    const runs = known.find((folder) => folder.system === 'INBOX')?.polls ?? 0;
    if (refreshFolders || !known.length || runs % this.options.folderRefreshEvery === 0)
      await this.refreshFolders(client);

    const ordered = folderSyncOrder(
      this.store.folders().map((folder) => ({
        path: folder.path,
        delimiter: folder.delimiter,
        labelId: folder.labelId,
        name: folder.path,
        system: folder.system as MappedFolder['system'],
        skip: folder.skip,
      })),
    );
    for (const mapped of ordered) {
      const state = this.store.folder(mapped.path);
      if (!state) continue;
      const before = this.options.budget - this.budget;
      try {
        const changed = await this.syncFolder(client, state);
        if (changed) result.foldersChanged.push(state.path);
      } catch (error) {
        // A broken folder (e.g. deleted mid-sync) must not stall the others.
        if (client.isClosed) throw error;
        console.warn('[imap-sync] folder sync failed', {
          folder: mapped.path,
          error: String(error),
        });
      }
      result.fetched += this.options.budget - this.budget - before;
      if (this.budget <= 0) {
        result.complete = false;
        break;
      }
    }
    if (this.budget > 0) {
      try {
        if (await this.categorizeBackfill(client)) result.complete = false;
      } catch (error) {
        if (client.isClosed) throw error;
        console.warn('[imap-sync] categorize backfill failed', { error: String(error) });
      }
    }
    if (result.complete) {
      result.complete = this.store
        .folders()
        .every((folder) => folder.skip || (folder.backfillDone && folder.uidValidity > 0));
    }
    return result;
  }

  /**
   * Re-fetches headers for inbox mail indexed before categorization existed, newest
   * first, within the run budget. Returns true while more remains.
   */
  private async categorizeBackfill(client: ImapClient) {
    const inbox = this.store.folders().find((folder) => folder.system === 'INBOX' && !folder.skip);
    if (!inbox || inbox.uidValidity === 0) return false;
    const wanted = this.store.uncategorizedUids(inbox.path, CATEGORIZE_BACKFILL_BATCH + 1);
    if (!wanted.length) return false;
    const take = wanted.slice(
      0,
      this.takeBudget(Math.min(wanted.length, CATEGORIZE_BACKFILL_BATCH)),
    );
    if (!take.length) return true;
    await client.select(inbox.path, { readOnly: true });
    await this.fetchUids(client, inbox, take);
    return wanted.length > take.length || this.store.uncategorizedUids(inbox.path, 1).length > 0;
  }

  private takeBudget(wanted: number) {
    const granted = Math.max(0, Math.min(wanted, this.budget));
    this.budget -= granted;
    return granted;
  }

  private async fetchUids(
    client: ImapClient,
    state: FolderState,
    uids: number[],
    options: { live?: boolean } = {},
  ) {
    const items = this.fetchItems(client);
    for (let i = 0; i < uids.length; i += this.options.batchSize) {
      const chunk = uids.slice(i, i + this.options.batchSize);
      const messages = await client.uidFetch(toSequenceSet(chunk), items);
      this.ingest(state.path, state.uidValidity, messages, options);
    }
  }

  /** Returns true when anything in the folder changed. */
  async syncFolder(client: ImapClient, initial: FolderState): Promise<boolean> {
    let state = initial;
    const condstore = client.has('CONDSTORE');
    const qresync = client.enabled.has('QRESYNC');
    const isNew = state.uidValidity === 0;

    if (!isNew) {
      const items = ['UIDNEXT', 'UIDVALIDITY', 'MESSAGES'];
      if (condstore) items.push('HIGHESTMODSEQ');
      const status = await client.status(state.path, items);
      if (status.UIDVALIDITY && status.UIDVALIDITY !== state.uidValidity) {
        this.store.resetFolder(state.path);
        state = this.store.folder(state.path)!;
        return this.syncFolder(client, state);
      }
      const rescanDue =
        !condstore && (state.system === 'INBOX' || state.polls % 5 === 0) && state.messages > 0;
      const unchanged =
        status.UIDNEXT === state.uidNext &&
        status.MESSAGES === state.messages &&
        (!condstore || !status.HIGHESTMODSEQ || status.HIGHESTMODSEQ === state.highestModseq);
      if (unchanged && state.backfillDone && !rescanDue) {
        this.store.updateFolderState(state.path, { polls: state.polls + 1 });
        return false;
      }
    }

    const info = await client.select(state.path, {
      readOnly: true,
      qresync:
        qresync && !isNew && state.highestModseq > 0
          ? { uidValidity: state.uidValidity, modseq: state.highestModseq }
          : undefined,
    });

    if (isNew || info.uidValidity !== state.uidValidity) {
      if (!isNew) this.store.resetFolder(state.path);
      this.store.updateFolderState(state.path, {
        uidValidity: info.uidValidity,
        uidNext: info.uidNext,
        backfillCursor: info.uidNext,
        backfillDone: info.exists === 0,
        highestModseq: info.highestModseq ?? 0,
        messages: info.exists,
      });
      state = this.store.folder(state.path)!;
      if (state.backfillDone) return true;
      await this.backfill(client, state);
      this.store.updateFolderState(state.path, { polls: state.polls + 1 });
      return true;
    }

    let fullyCaughtUp = true;

    // Expunges and flag changes reported by QRESYNC.
    if (info.vanished.length) this.store.removeLocations(state.path, info.vanished);
    for (const message of info.changed) {
      if (message.flags)
        this.store.updateFlags(state.path, message.uid, message.flags, message.modseq);
    }

    // New messages.
    let uidNext = state.uidNext;
    if (info.uidNext > state.uidNext || info.exists !== state.messages) {
      const fresh = (await client.uidSearch(['UID', `${Math.max(1, state.uidNext)}:*`])).filter(
        (uid) => uid >= state.uidNext,
      );
      const granted = this.takeBudget(fresh.length);
      const take = fresh.sort((a, b) => a - b).slice(0, granted);
      await this.fetchUids(client, state, take, { live: true });
      if (take.length < fresh.length) {
        fullyCaughtUp = false;
        uidNext = (take.at(-1) ?? state.uidNext - 1) + 1;
      } else uidNext = Math.max(info.uidNext, (take.at(-1) ?? 0) + 1);
    }

    const known = this.store.knownUids(state.path);
    const minKnown = known[0];

    // Flag changes without QRESYNC.
    if (!qresync && minKnown !== undefined) {
      if (condstore && state.highestModseq > 0 && !info.noModseq) {
        const changed = await client.uidFetch(`${minKnown}:*`, ['UID', 'FLAGS'], {
          changedSince: state.highestModseq,
        });
        for (const message of changed)
          if (message.flags)
            this.store.updateFlags(state.path, message.uid, message.flags, message.modseq);
      } else {
        const recent = this.store.recentUids(state.path, this.options.flagRescanWindow);
        if (recent.length) {
          const current = await client.uidFetch(toSequenceSet(recent), ['UID', 'FLAGS']);
          for (const message of current)
            if (message.flags) this.store.updateFlags(state.path, message.uid, message.flags);
        }
      }
    }

    // Expunges without QRESYNC: compare known UIDs with what the server still has.
    if (
      !qresync &&
      minKnown !== undefined &&
      (info.exists < state.messages || state.polls % 5 === 0)
    ) {
      const present = new Set(await client.uidSearch(['UID', `${minKnown}:*`]));
      const gone = known.filter((uid) => uid < uidNext && !present.has(uid));
      if (gone.length) this.store.removeLocations(state.path, gone);
    }

    this.store.updateFolderState(state.path, {
      uidNext,
      messages: info.exists,
      highestModseq: fullyCaughtUp ? (info.highestModseq ?? 0) : state.highestModseq,
      polls: state.polls + 1,
    });
    state = this.store.folder(state.path)!;
    if (!state.backfillDone) await this.backfill(client, state);
    return true;
  }

  private async backfill(client: ImapClient, state: FolderState) {
    const limit = state.system ? this.options.backfillLimitSystem : this.options.backfillLimitUser;
    const have = this.store.knownUids(state.path).length;
    if (have >= limit || state.backfillCursor <= 1) {
      this.store.updateFolderState(state.path, { backfillDone: true });
      return;
    }
    const since = new Date(Date.now() - this.options.backfillDays * 86_400_000);
    const candidates = (
      await client.uidSearch([
        'UID',
        `1:${state.backfillCursor - 1}`,
        'SINCE',
        formatSearchDate(since),
      ])
    )
      .filter((uid) => uid < state.backfillCursor)
      .sort((a, b) => b - a);
    const wanted = Math.min(candidates.length, limit - have);
    const granted = this.takeBudget(wanted);
    const take = candidates.slice(0, granted);
    if (take.length) await this.fetchUids(client, state, take);
    const done = take.length >= candidates.length || have + take.length >= limit;
    this.store.updateFolderState(state.path, {
      backfillCursor: take.length ? Math.min(...take) : state.backfillCursor,
      backfillDone: done,
    });
  }
}
