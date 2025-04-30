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

import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Column,
  Row,
  Text,
  Link,
  Preview,
  render,
} from '@react-email/components';

interface EmailTemplateProps {
  content: string;
  imagesEnabled: boolean;
  nonce: string;
}

const generateNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

const EmailTemplate = ({ content, imagesEnabled, nonce }: EmailTemplateProps) => {
  return (
    <Html>
      <Head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={
            imagesEnabled
              ? `default-src 'none'; img-src * data: blob: 'unsafe-inline'; style-src 'unsafe-inline' *; font-src *; script-src 'nonce-${nonce}';`
              : `default-src 'none'; img-src data:; style-src 'unsafe-inline' *; font-src *; script-src 'nonce-${nonce}';`
          }
        />
        <style>
          {`
            @media (prefers-color-scheme: dark) {
              body, table, td, div, p {
                background: transparent !important;
                background-color: #1A1A1A !important;
                font-size: 16px !important;
              }
              * {
                background: transparent !important;
                background-color: #1A1A1A !important;
                font-size: 16px !important;
              }
            }
            @media (prefers-color-scheme: light) {
              body, table, td, div, p {
                background: transparent !important;
                background-color: white !important;
                font-size: 16px !important;
              }
              * {
                background: transparent !important;
                background-color: white !important;
                font-size: 16px !important;
              }
            }
          `}
        </style>
        <script nonce={nonce}>
          {`
            document.addEventListener('securitypolicyviolation', (e) => {
              // Send the violation details to the parent window
              window.parent.postMessage({
                type: 'csp-violation',
              }, '*');
            });
          `}
        </script>
      </Head>
      <Body style={{ margin: 0, padding: 0, background: 'transparent' }}>
        <Container style={{ width: '100%', maxWidth: '100%', background: 'transparent', padding: 0, margin: 0 }}>
          <Section style={{ width: '100%', background: 'transparent', padding: 0, margin: 0 }}>
            <Row style={{ background: 'transparent', padding: 0, margin: 0 }}>
              <Column style={{ background: 'transparent', padding: 0, margin: 0 }}>
                <div style={{ background: 'transparent', fontSize: '16px', lineHeight: '1.5' }} dangerouslySetInnerHTML={{ __html: content }} />
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = async (html: string, imagesEnabled: boolean = false) => {
  if (typeof DOMParser === 'undefined') return html;
  const nonce = generateNonce();

  // Create the email template
  const emailHtml = await render(
    <EmailTemplate content={html} imagesEnabled={imagesEnabled} nonce={nonce} />,
  );
  return emailHtml;
};
