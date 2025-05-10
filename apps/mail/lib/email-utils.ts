import { parseFrom as _parseFrom, parseAddressList as _parseAddressList } from 'email-addresses';
import type { Sender } from '@/types';
import Color from 'color';

export const fixNonReadableColors = (rootElement: HTMLElement, minContrast = 3.5) => {
  const elements = Array.from<HTMLElement>(rootElement.querySelectorAll('*'));
  elements.unshift(rootElement);

  for (const el of elements) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    // Skip if the color is a CSS variable or special value
    if (
      style.color.startsWith('var(') ||
      style.color === 'transparent' ||
      style.color === 'inherit'
    ) {
      continue;
    }

    const textColor = Color(style.color);
    const effectiveBg = getEffectiveBackgroundColor(el);

    const blendedText =
      textColor.alpha() < 1 ? effectiveBg.mix(textColor, effectiveBg.alpha()) : textColor;
    const contrast = blendedText.contrast(effectiveBg);

    if (contrast < minContrast) {
      const blackContrast = Color('#000000').contrast(effectiveBg);
      const whiteContrast = Color('#ffffff').contrast(effectiveBg);
      el.style.color = blackContrast >= whiteContrast ? '#000000' : '#ffffff';
    }
  }
};

const getEffectiveBackgroundColor = (element: HTMLElement) => {
  let current: HTMLElement | null = element;
  while (current) {
    const bg = Color(getComputedStyle(current).backgroundColor);
    if (bg.alpha() >= 1) return bg.rgb();
    current = current.parentElement;
  }
  return Color('#ffffff');
};

type ListUnsubscribeAction =
  | { type: 'get'; url: string; host: string }
  | { type: 'post'; url: string; body: string; host: string }
  | { type: 'email'; emailAddress: string; subject: string; host: string };

const processHttpUrl = (url: URL, listUnsubscribePost?: string) => {
  if (listUnsubscribePost) {
    return {
      type: 'post' as const,
      url: url.toString(),
      body: listUnsubscribePost,
      host: url.hostname,
    };
  }
  return { type: 'get' as const, url: url.toString(), host: url.hostname };
};

// Relevant specs:
// - https://www.ietf.org/rfc/rfc2369.txt (list-unsubscribe)
// - https://www.ietf.org/rfc/rfc8058.txt (list-unsubscribe-post)
export const getListUnsubscribeAction = ({
  listUnsubscribe,
  listUnsubscribePost,
}: {
  listUnsubscribe: string;
  listUnsubscribePost?: string;
}): ListUnsubscribeAction | null => {
  const match = listUnsubscribe.match(/<([^>]+)>/);

  if (!match || !match[1]) {
    // NOTE: Some senders do not implement a spec-compliant list-unsubscribe header (e.g. Linear).
    // We can be a bit more lenient and try to parse the header as a URL, Gmail also does this.
    try {
      const url = new URL(listUnsubscribe);
      if (url.protocol.startsWith('http')) {
        return processHttpUrl(url, listUnsubscribePost);
      }
      return null;
    } catch {
      return null;
    }
  }

  // NOTE: List-Unsubscribe can contain multiple URLs, but the spec says to process the first one we can.
  const url = new URL(match[1]);

  if (url.protocol.startsWith('http')) {
    return processHttpUrl(url, listUnsubscribePost);
  }

  if (url.protocol === 'mailto:') {
    const emailAddress = url.pathname;
    const subject = new URLSearchParams(url.search).get('subject') || '';

    return { type: 'email', emailAddress, subject, host: url.hostname };
  }

  return null;
};

const FALLBACK_SENDER: Sender = {
  name: '',
  email: 'no-sender@unknown',
} as const;

export const parseFrom = (fromHeader: string | null | undefined): Sender => {
  if (!fromHeader?.trim()) return FALLBACK_SENDER;
  
  try {
    const parsedSender = _parseFrom(fromHeader);
    if (!parsedSender) return FALLBACK_SENDER;

    const firstSender = parsedSender[0];
    if (!firstSender) return FALLBACK_SENDER;

    if (firstSender.type === 'group') {
      const name = firstSender.name || FALLBACK_SENDER.name;
      const firstAddress = firstSender.addresses?.[0]?.address;
      const email = firstAddress || FALLBACK_SENDER.email;
      return { name, email };
    }

    return {
      name: firstSender.name || firstSender.address || FALLBACK_SENDER.name,
      email: firstSender.address || FALLBACK_SENDER.email,
    };
  } catch (error) {
    console.warn('Error parsing From header:', error);
    return FALLBACK_SENDER;
  }
};

export const parseAddressList = (header: string | null | undefined): Sender[] => {
  if (!header?.trim()) return [FALLBACK_SENDER];

  try {
    const parsedAddressList = _parseAddressList(header);
    if (!parsedAddressList?.length) return [FALLBACK_SENDER];

    return parsedAddressList.flatMap((address): Sender[] => {
      if (address.type === 'group') {
        return (address.addresses || []).map((addr): Sender => ({
          name: addr.name || FALLBACK_SENDER.name,
          email: addr.address || FALLBACK_SENDER.email,
        }));
      }

      return [{
        name: address.name || FALLBACK_SENDER.name,
        email: address.address || FALLBACK_SENDER.email,
      }];
    });
  } catch (error) {
    console.warn('Error parsing address list:', error);
    return [FALLBACK_SENDER];
  }
};

export const cleanEmailAddresses = (emails: string | null | undefined): string[] | undefined => {
  if (!emails?.trim()) return undefined;
  
  return emails
    .split(',')
    .map(email => email.trim().replace(/^[<\s]+|[>\s]+$/g, ''))
    .filter(Boolean);
};

export const formatRecipients = (recipients: string[] | undefined | null): string | undefined => {
  if (!recipients?.length) return undefined;
  return recipients.join(', ');
};

export interface MimeRecipient {
  addr: string;
  name?: string;
}

export const formatMimeRecipients = (recipients: string | string[] | null | undefined): MimeRecipient[] | null => {
  if (!recipients) return null;

  try {
    if (Array.isArray(recipients)) {
      return recipients
        .filter(Boolean)
        .map(recipient => ({ addr: recipient.trim() }));
    }
    
    if (typeof recipients === 'string' && recipients.trim()) {
      return recipients
        .split(',')
        .map(recipient => recipient.trim())
        .filter(Boolean)
        .map(recipient => ({ addr: recipient }));
    }
  } catch (error) {
    console.warn('Error formatting MIME recipients:', error);
  }
  
  return null;
};

export const TLS_SECURITY_PATTERNS = {
  PROTOCOL: [
    /using\s+TLS/i,
    /with\s+ESMTPS/i,
    /version=TLS[0-9_.]+/i,
    /TLSv[0-9.]+/i,
  ],
  CIPHER: [
    /cipher=[A-Z0-9-]+/i,
    /with\s+[A-Z0-9-]+\s+encryption/i,
  ],
} as const;

export const wasSentWithTLS = (receivedHeaders: string[]): boolean => {
  for (const header of receivedHeaders.reverse()) {
    const hasProtocol = TLS_SECURITY_PATTERNS.PROTOCOL.some(pattern => pattern.test(header));
    const hasCipher = TLS_SECURITY_PATTERNS.CIPHER.some(pattern => pattern.test(header));
    
    if (hasProtocol || hasCipher) {
      return true;
    }
  }

  return false;
};
