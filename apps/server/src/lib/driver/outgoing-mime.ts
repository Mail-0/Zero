/**
 * Builds RFC 5322 messages from the app's outgoing message / draft shapes. Shared by the
 * Gmail driver (which uploads raw MIME) and the IMAP driver (which submits it over SMTP and
 * APPENDs it to Sent/Drafts).
 */
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import type { IOutgoingMessage } from '../../types';
import type { CreateDraftData } from '../schemas';
import { createMimeMessage } from 'mimetext';

export const ZERO_SUGGESTION_HEADER = 'X-Zero-Suggestion';

/** Normalize a whitespace-separated list of Message-IDs to `<a@b> <c@d>` form. */
export const toMessageIdList = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((ref) => {
      if (!ref.startsWith('<')) ref = `<${ref}`;
      if (!ref.endsWith('>')) ref = `${ref}>`;
      return ref;
    })
    .join(' ');

/** Bare address from `Name <a@b>` or `a@b`. */
export const addressOf = (value: string) => {
  const match = /<([^>]+)>/.exec(value);
  return (match ? match[1]! : value).trim();
};

export interface BuiltMime {
  raw: string;
  /** Envelope recipients (To + Cc + Bcc), deduplicated. */
  recipients: string[];
}

export interface BuildOptions {
  /** Used when `fromEmail` is not set. */
  defaultFrom: string;
  /** Overrides the generated Message-ID (`<id@host>`). */
  messageId?: string;
  /**
   * Gmail historically set the sender to `fromEmail` verbatim (even if empty) and lets Gmail
   * fill it in. Other transports need a real From.
   */
  literalSender?: boolean;
}

export const buildOutgoingMime = async (
  {
    to,
    subject,
    message,
    attachments,
    headers,
    cc,
    bcc,
    fromEmail,
    originalMessage = null,
  }: IOutgoingMessage,
  options: BuildOptions,
): Promise<BuiltMime> => {
  const msg = createMimeMessage();

  const senderEmail = fromEmail || options.defaultFrom;

  msg.setSender(options.literalSender ? `${fromEmail}` : senderEmail);

  const uniqueRecipients = new Set<string>();

  if (!Array.isArray(to)) {
    throw new Error('Recipient address required');
  }

  if (to.length === 0) {
    throw new Error('Recipient address required');
  }

  const toRecipients = to
    .filter((recipient) => {
      if (!recipient || !recipient.email) {
        return false;
      }

      const email = recipient.email.toLowerCase();

      if (!uniqueRecipients.has(email)) {
        uniqueRecipients.add(email);
        return true;
      }
      return false;
    })
    .map((recipient) => {
      const emailMatch = recipient.email.match(/<([^>]+)>/);
      const email = emailMatch ? emailMatch[1] : recipient.email;
      if (!email) {
        throw new Error('Invalid email address');
      }
      return {
        name: recipient.name || '',
        addr: email,
      };
    });

  if (toRecipients.length > 0) {
    msg.setRecipients(toRecipients);
  } else {
    throw new Error('No valid recipients found in To field');
  }

  const envelope = toRecipients.map((recipient) => recipient.addr);

  if (Array.isArray(cc) && cc.length > 0) {
    const ccRecipients = cc
      .filter((recipient) => {
        const email = recipient.email.toLowerCase();
        if (!uniqueRecipients.has(email) && email !== senderEmail) {
          uniqueRecipients.add(email);
          return true;
        }
        return false;
      })
      .map((recipient) => ({
        name: recipient.name || '',
        addr: recipient.email,
      }));

    if (ccRecipients.length > 0) {
      msg.setCc(ccRecipients);
      envelope.push(...ccRecipients.map((recipient) => recipient.addr));
    }
  }

  if (Array.isArray(bcc) && bcc.length > 0) {
    const bccRecipients = bcc
      .filter((recipient) => {
        const email = recipient.email.toLowerCase();
        if (!uniqueRecipients.has(email) && email !== senderEmail) {
          uniqueRecipients.add(email);
          return true;
        }
        return false;
      })
      .map((recipient) => ({
        name: recipient.name || '',
        addr: recipient.email,
      }));

    if (bccRecipients.length > 0) {
      msg.setBcc(bccRecipients);
      envelope.push(...bccRecipients.map((recipient) => recipient.addr));
    }
  }

  msg.setSubject(subject);

  const { html: processedMessage, inlineImages } = await sanitizeTipTapHtml(message.trim());

  if (originalMessage) {
    msg.addMessage({
      contentType: 'text/html',
      data: `${processedMessage}${originalMessage}`,
    });
  } else {
    msg.addMessage({
      contentType: 'text/html',
      data: processedMessage,
    });
  }

  if (inlineImages.length > 0) {
    for (const image of inlineImages) {
      msg.addAttachment({
        inline: true,
        filename: `${image.cid}`,
        contentType: image.mimeType,
        data: image.data,
        headers: {
          'Content-ID': `<${image.cid}>`,
          'Content-Disposition': 'inline',
        },
      });
    }
  }

  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      if (value) {
        if (key.toLowerCase() === 'references' && value) {
          msg.setHeader(key, toMessageIdList(value));
        } else {
          msg.setHeader(key, value);
        }
      }
    });
  }

  if (options.messageId) msg.setHeader('Message-ID', options.messageId);

  if (attachments?.length > 0) {
    for (const file of attachments) {
      const base64Content = file.base64;

      msg.addAttachment({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        data: base64Content,
      });
    }
  }

  return { raw: msg.asRaw(), recipients: [...new Set(envelope.map(addressOf))] };
};

const splitRecipients = (value: string | undefined) =>
  (value ?? '')
    .split(/,\s*/)
    .map((recipient) => recipient.trim())
    .filter(Boolean)
    .map((recipient) => {
      if (recipient.includes('<')) {
        const [name, email] = recipient.split('<');
        return { addr: email!.replace('>', '').trim(), name: name!.replace(/"/g, '').trim() };
      }
      return { addr: recipient };
    });

/** MIME for a draft (no envelope; it is stored, not sent). */
export const buildDraftMime = async (
  data: CreateDraftData,
  options: { from: string; messageId?: string },
): Promise<string> => {
  const { html: message, inlineImages } = await sanitizeTipTapHtml(data.message);
  const msg = createMimeMessage();
  msg.setSender(data.fromEmail || options.from);
  const to = splitRecipients(data.to);
  // mimetext requires a recipient; drafts may legitimately have none yet.
  if (to.length) msg.setTo(to);
  const cc = splitRecipients(data.cc);
  if (cc.length) msg.setCc(cc);
  const bcc = splitRecipients(data.bcc);
  if (bcc.length) msg.setBcc(bcc);
  msg.setSubject(data.subject);
  if (data.inReplyTo) msg.setHeader('In-Reply-To', toMessageIdList(data.inReplyTo));
  if (data.references) msg.setHeader('References', toMessageIdList(data.references));
  if (data.isZeroSuggestion) msg.setHeader(ZERO_SUGGESTION_HEADER, 'true');
  if (options.messageId) msg.setHeader('Message-ID', options.messageId);
  msg.addMessage({ contentType: 'text/html', data: message || '' });
  for (const image of inlineImages) {
    msg.addAttachment({
      inline: true,
      filename: `${image.cid}`,
      contentType: image.mimeType,
      data: image.data,
      headers: { 'Content-ID': `<${image.cid}>`, 'Content-Disposition': 'inline' },
    });
  }
  for (const attachment of data.attachments ?? []) {
    msg.addAttachment({
      filename: attachment.name,
      contentType: attachment.type || 'application/octet-stream',
      data: attachment.base64,
    });
  }
  return msg.asRaw();
};
