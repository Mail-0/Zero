import { AssistantToolError } from './assistant-utils';
import type { ParsedMessage, Sender } from '../types';
import { parseAddressList } from './email-utils';
import { z } from 'zod';

export type RecipientOverrides = { to?: Sender[]; cc?: Sender[]; bcc?: Sender[] };
type ReplySource = Pick<ParsedMessage, 'sender' | 'to' | 'cc'> & { replyTo?: string };

export function resolveReplyEnvelope(
  source: ReplySource,
  selfEmails: string[],
  mode: 'reply' | 'reply_all',
  overrides: RecipientOverrides = {},
) {
  const self = new Set(selfEmails.map((email) => email.trim().toLowerCase()));
  const external = (list: Sender[]) =>
    list.filter(({ email }) => !self.has(email.trim().toLowerCase()));
  const sentBySelf = self.has(source.sender.email.trim().toLowerCase());
  const replyTo = sentBySelf
    ? (source.to ?? [])
    : source.replyTo
      ? parseAddressList(source.replyTo)
      : [source.sender];
  const defaultTo = external(mode === 'reply_all' ? [...replyTo, ...(source.to ?? [])] : replyTo);
  return normalizeEnvelope(
    overrides.to ?? defaultTo,
    overrides.cc ?? (mode === 'reply_all' ? external(source.cc ?? []) : []),
    overrides.bcc ?? [],
  );
}

export function normalizeEnvelope(
  toValues: Sender[],
  ccValues: Sender[] = [],
  bccValues: Sender[] = [],
) {
  const seen = new Set<string>();
  const unique = (list: Sender[]) =>
    list.flatMap(({ email, name }) => {
      const address = z.string().trim().email().parse(email).toLowerCase();
      if (seen.has(address)) return [];
      seen.add(address);
      return [{ email: address, ...(name?.trim() ? { name: name.trim() } : {}) }];
    });
  const to = unique(toValues);
  const cc = unique(ccValues);
  const bcc = unique(bccValues);
  if (!to.length)
    throw new AssistantToolError(
      'No reply recipient remains. Provide an explicit To recipient or choose a different incoming message.',
      'reply_recipient_unavailable',
    );
  return { to, cc, bcc };
}
