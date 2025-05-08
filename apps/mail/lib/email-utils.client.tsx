'use client';

import { Html, Head, Body, Container, Section, Column, Row, render } from '@react-email/components';
import { getListUnsubscribeAction } from '@/lib/email-utils';
import { trpcClient } from '@/providers/query-provider';
import type { ParsedMessage } from '@/types';
import { useEffect, useState } from 'react';
import { track } from '@vercel/analytics';
import { useTheme } from 'next-themes';

export const handleUnsubscribe = async ({ emailData }: { emailData: ParsedMessage }) => {
  try {
    if (emailData.listUnsubscribe) {
      const listUnsubscribeAction = getListUnsubscribeAction({
        listUnsubscribe: emailData.listUnsubscribe,
        listUnsubscribePost: emailData.listUnsubscribePost,
      });
      if (listUnsubscribeAction) {
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
            await trpcClient.mail.send.mutate({
              to: [
                {
                  email: listUnsubscribeAction.emailAddress,
                  name: listUnsubscribeAction.emailAddress,
                },
              ],
              subject: listUnsubscribeAction.subject.trim().length
                ? listUnsubscribeAction.subject
                : 'Unsubscribe Request',
              message: 'Zero sent this email to unsubscribe from this mailing list.',
            });
            return true;
        }
        track('Unsubscribe', {
          domain: emailData.sender.email.split('@')?.[1] ?? 'unknown',
        });
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

interface EmailTemplateProps {
  content: string;
  imagesEnabled: boolean;
  nonce: string;
  backgroundColor: string;
}

const generateNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

const forceExternalLinks = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const links = doc.querySelectorAll('a:not([target="_blank"])');
  links.forEach((link) => {
    link.setAttribute('target', '_blank');
  });

  return doc.body.innerHTML;
};

const getProxiedUrl = (url: string) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const proxyUrl = process.env.NEXT_PUBLIC_IMAGE_PROXY?.trim();
  if (!proxyUrl) return url;

  return proxyUrl + encodeURIComponent(url);
};

const proxyImageUrls = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;

    const proxiedUrl = getProxiedUrl(src);
    if (proxiedUrl !== src) {
      img.setAttribute('data-original-src', src);
      img.setAttribute('src', proxiedUrl);
      img.setAttribute(
        'onerror',
        `this.onerror=null; this.src=this.getAttribute('data-original-src');`,
      );
    }
  });

  doc.querySelectorAll('[style*="background-image"]').forEach((element) => {
    const style = element.getAttribute('style');
    if (!style) return;

    const newStyle = style.replace(/background-image:\s*url\(['"]?(.*?)['"]?\)/g, (match, url) => {
      const proxiedUrl = getProxiedUrl(url);
      if (proxiedUrl !== url) {
        element.setAttribute('data-original-bg', url);
        return `background-image: url('${proxiedUrl}')`;
      }
      return match;
    });
    element.setAttribute('style', newStyle);
  });

  return doc.body.innerHTML;
};

const EmailTemplate = ({ content, imagesEnabled, nonce, backgroundColor }: EmailTemplateProps) => {
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
            @font-face {
              font-family: 'Geist';
              src: url('/fonts/geist/Geist-Regular.ttf') format('truetype');
              font-weight: 400;
              font-style: normal;
            }
            @font-face {
              font-family: 'Geist';
              src: url('/fonts/geist/Geist-Medium.ttf') format('truetype');
              font-weight: 500;
              font-style: normal;
            }
            @font-face {
              font-family: 'Geist';
              src: url('/fonts/geist/Geist-SemiBold.ttf') format('truetype');
              font-weight: 600;
              font-style: normal;
            }
            @font-face {
              font-family: 'Geist';
              src: url('/fonts/geist/Geist-Bold.ttf') format('truetype');
              font-weight: 700;
              font-style: normal;
            }
            body, table, td, div, p {
              background: transparent !important;
              background-color: hsl(${backgroundColor}) !important;
              font-size: 16px !important;
              font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            }
            * {
              background: transparent !important;
              background-color: hsl(${backgroundColor}) !important;
              font-size: 16px !important;
              font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
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
        <Container
          style={{
            width: '100%',
            maxWidth: '100%',
            background: 'transparent',
            padding: 0,
            margin: 0,
          }}
        >
          <Section style={{ width: '100%', background: 'transparent' }}>
            <Row style={{ background: 'transparent' }}>
              <Column style={{ background: 'transparent' }}>
                <div dangerouslySetInnerHTML={{ __html: content }} />
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = async (
  html: string,
  imagesEnabled: boolean = false,
  backgroundColor: string,
) => {
  if (typeof DOMParser === 'undefined') return html;
  const nonce = generateNonce();
  let processedHtml = forceExternalLinks(html);

  if (imagesEnabled) {
    processedHtml = proxyImageUrls(processedHtml);
  }

  const emailHtml = await render(
    <EmailTemplate
      content={processedHtml}
      imagesEnabled={imagesEnabled}
      nonce={nonce}
      backgroundColor={backgroundColor}
    />,
  );
  return emailHtml;
};
