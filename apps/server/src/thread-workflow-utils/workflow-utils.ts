import type { ParsedMessage } from '../types';
import * as cheerio from 'cheerio';

export async function htmlToText(decodedBody: string): Promise<string> {
  try {
    if (!decodedBody || typeof decodedBody !== 'string') {
      return '';
    }
    const $ = cheerio.load(decodedBody);
    $('script').remove();
    $('style').remove();
    return $('body')
      .text()
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

export const escapeXml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const messageToXML = async (message: ParsedMessage) => {
  try {
    if (!message.decodedBody) return null;
    const body = await htmlToText(message.decodedBody || '');
    if (!body || body.length < 10) {
      return null;
    }

    const safeSenderName = escapeXml(message.sender?.name || 'Unknown');
    const safeSubject = escapeXml(message.subject || '');
    const safeDate = escapeXml(message.receivedOn || '');

    const toElements = (message.to || [])
      .map((r: any) => `<to>${escapeXml(r?.email || '')}</to>`)
      .join('');
    const ccElements = (message.cc || [])
      .map((r: any) => `<cc>${escapeXml(r?.email || '')}</cc>`)
      .join('');

    return `
        <message>
          <from>${safeSenderName}</from>
          ${toElements}
          ${ccElements}
          <date>${safeDate}</date>
          <subject>${safeSubject}</subject>
          <body>${escapeXml(body)}</body>
        </message>
        `;
  } catch (error) {
    console.log('[MESSAGE_TO_XML] Failed to convert message to XML:', {
      messageId: message.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const getParticipants = (messages: ParsedMessage[]) => {
  const participants = new Map<string, { name?: string; email: string }>();

  const setIfUnset = (sender: any) => {
    if (!sender?.email) return;
    if (!participants.has(sender.email)) {
      participants.set(sender.email, {
        name: sender.name,
        email: sender.email,
      });
    }
  };

  messages.forEach((message) => {
    setIfUnset(message.sender);
    (message.to || []).forEach(setIfUnset);
    (message.cc || []).forEach(setIfUnset);
  });

  return Array.from(participants.values());
};

export const threadToXML = async (messages: ParsedMessage[], existingSummary?: string) => {
  const participants = getParticipants(messages);
  const title = messages[0]?.subject || 'No Subject';
  const subject = messages[0]?.subject || 'No Subject';

  const participantsXML = participants
    .map((p) => {
      const displayName = escapeXml(p.name || p.email);
      const emailTag = p.name ? `< ${escapeXml(p.email)} >` : '';
      return `<participant>${displayName} ${emailTag}</participant>`;
    })
    .join('');

  const messagesXML = await Promise.all(messages.map(messageToXML));
  const validMessagesXML = messagesXML.filter(Boolean).join('');

  return `
    <thread>
      <title>${escapeXml(title)}</title>
      <subject>${escapeXml(subject)}</subject>
      <participants>
        ${participantsXML}
      </participants>
      ${existingSummary ? `<summary>${escapeXml(existingSummary)}</summary>` : ''}
      <messages>
        ${validMessagesXML}
      </messages>
    </thread>
  `;
};
