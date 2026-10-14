/**
 * Header-based inbox categories for IMAP mail, the counterpart of Gmail's Personal /
 * Promotions / Updates tabs. Deterministic and free; the AI workflow may refine a thread's
 * category afterwards (see ImapIndexStore.setThreadCategory).
 */

export type MailCategory = 'personal' | 'promotions' | 'updates';

export const CATEGORY_LABELS: Record<MailCategory, string> = {
  personal: 'CATEGORY_PERSONAL',
  promotions: 'CATEGORY_PROMOTIONS',
  updates: 'CATEGORY_UPDATES',
};

export const isMailCategory = (value: unknown): value is MailCategory =>
  value === 'personal' || value === 'promotions' || value === 'updates';

/** Headers the classifier reads; the sync fetches them with the threading headers. */
export const CATEGORY_HEADER_FIELDS =
  'FROM TO CC LIST-ID LIST-UNSUBSCRIBE PRECEDENCE AUTO-SUBMITTED FEEDBACK-ID X-AUTO-RESPONSE-SUPPRESS X-CAMPAIGN';

/** Automated senders: notifications, receipts, alerts. */
const AUTOMATED_SENDER =
  /^(no-?reply|do-?not-?reply|donotreply|notifications?|notify|alerts?|mailer-daemon|postmaster|bounces?|automated|system|accounts?|security|billing|receipts?|orders?|shipping|support|service|updates?)([+._-].*)?@/i;

/** Marketing senders. */
const MARKETING_SENDER =
  /^(news(letters?)?|marketing|promo(tions?)?|offers?|deals?|sales|hello|hi|team|info|digest)([+._-].*)?@/i;

export interface CategoryInput {
  /** Lowercase header name -> values. */
  headers: Map<string, string[]>;
  /** The sender is someone the user has written to. */
  knownContact?: boolean;
}

const first = (headers: Map<string, string[]>, name: string) => headers.get(name)?.[0] ?? null;

/** `Alice <a@x.com>` -> `a@x.com` (lowercase). */
export const emailAddress = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const match = /<([^<>\s]+@[^<>\s]+)>/.exec(value) ?? /([^\s<>",;]+@[^\s<>",;]+)/.exec(value);
  return match ? match[1]!.toLowerCase() : null;
};

/** Every address in address-list headers (To, Cc). */
export const emailAddresses = (values: string[] | undefined): string[] =>
  (values ?? []).flatMap((value) =>
    [...value.matchAll(/([^\s<>",;:]+@[^\s<>",;]+)/g)].map((m) => m[1]!.toLowerCase()),
  );

export const classifyMessage = ({ headers, knownContact = false }: CategoryInput): MailCategory => {
  const sender = emailAddress(first(headers, 'from')) ?? '';
  const listUnsubscribe = headers.has('list-unsubscribe');
  const listId = headers.has('list-id');
  const precedence = (first(headers, 'precedence') ?? '').toLowerCase();
  const bulk = precedence === 'bulk' || precedence === 'junk';
  const autoSubmitted = (first(headers, 'auto-submitted') ?? 'no').toLowerCase() !== 'no';
  const campaign = headers.has('feedback-id') || headers.has('x-campaign');

  // People the user corresponds with stay personal unless it's clearly a mass mailing.
  if (knownContact && !listUnsubscribe && !bulk) return 'personal';

  // Discussion lists (Precedence: list, List-Id without marketing signals) are updates.
  if (precedence === 'list' && !campaign && !MARKETING_SENDER.test(sender)) return 'updates';

  if (listUnsubscribe || bulk) {
    // Transactional mail sometimes carries List-Unsubscribe; automated senders without
    // campaign markers are updates rather than promotions.
    if (!campaign && !bulk && AUTOMATED_SENDER.test(sender) && !MARKETING_SENDER.test(sender))
      return 'updates';
    return 'promotions';
  }

  if (listId) return 'updates';
  if (autoSubmitted || headers.has('x-auto-response-suppress')) return 'updates';
  if (AUTOMATED_SENDER.test(sender)) return 'updates';
  // A marketing-looking address alone (info@, hello@) is often a real person; only
  // ESP campaign markers make unlisted mail a promotion.
  if (campaign) return 'promotions';
  return 'personal';
};
