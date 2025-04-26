'use client';

import { getListUnsubscribeAction } from '@/lib/email-utils';
import type { ParsedMessage } from '@/types';
import { sendEmail } from '@/actions/send';
import { track } from '@vercel/analytics';

export const handleUnsubscribe = async ({ emailData }: { emailData: ParsedMessage }) => {
  try {
    if (emailData.listUnsubscribe) {
      const listUnsubscribeAction = getListUnsubscribeAction({
        listUnsubscribe: emailData.listUnsubscribe,
        listUnsubscribePost: emailData.listUnsubscribePost,
      });
      if (listUnsubscribeAction) {
        track('Unsubscribe', {
          domain: emailData.sender.email.split('@')?.[1] ?? 'unknown',
        });
        switch (listUnsubscribeAction.type) {
          case 'get':
            window.open(listUnsubscribeAction.url, '_blank');
            break;
          case 'post':
            const controller = new AbortController();
            const timeoutId = setTimeout(
              () => controller.abort(),
              10000, // 10 seconds
            );

            await fetch(listUnsubscribeAction.url, {
              mode: 'no-cors',
              method: 'POST',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
              },
              body: listUnsubscribeAction.body,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return true;
          case 'email':
            await sendEmail({
              to: [
                {
                  email: listUnsubscribeAction.emailAddress,
                  name: listUnsubscribeAction.emailAddress,
                },
              ],
              subject: listUnsubscribeAction.subject,
              message: 'Zero sent this email to unsubscribe from this mailing list.',
              attachments: [],
            });
            return true;
        }
      }
    }
  } catch (error) {
    console.warn('Error unsubscribing', emailData);
    throw error;
  }
};

export const highlightText = (text: string, highlight: string) => {
  if (!highlight?.trim()) return text;

  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    return i % 2 === 1 ? (
      <span
        key={i}
        className="ring-0.5 bg-primary/10 inline-flex items-center justify-center rounded px-1"
      >
        {part}
      </span>
    ) : (
      part
    );
  });
};
