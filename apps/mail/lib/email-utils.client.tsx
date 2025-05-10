'use client';

import { Html, Head, Body, Container, Section, Column, Row, render } from '@react-email/components';
import { getListUnsubscribeAction } from '@/lib/email-utils';
import { trpcClient } from '@/providers/query-provider';
import type { ParsedMessage } from '@/types';
import { track } from '@vercel/analytics';
import { CSP_DIRECTIVES, FONTS } from './constants';
import { generateEmailStyles } from './email-style-utils';

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
}

const generateNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
};

const getProxiedUrl = (url: string) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  const proxyUrl = process.env.NEXT_PUBLIC_IMAGE_PROXY?.trim();
  if (!proxyUrl) return url;
  
  return proxyUrl + encodeURIComponent(url);
};

export const forceExternalLinks = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('a').forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });

  return doc.body.innerHTML;
};

export const proxyImageUrls = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src) return;
    
    const proxiedUrl = getProxiedUrl(src);
    if (proxiedUrl !== src) {
      img.setAttribute('data-original-src', src);
      img.setAttribute('src', proxiedUrl);
      img.setAttribute('onerror', `this.onerror=null; this.src=this.getAttribute('data-original-src');`);
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

const EmailTemplate = ({ content, imagesEnabled, nonce }: EmailTemplateProps) => {
  const cspDirectives = [
    CSP_DIRECTIVES.DEFAULT,
    CSP_DIRECTIVES.STYLE,
    CSP_DIRECTIVES.FONT,
    CSP_DIRECTIVES.SCRIPT(nonce),
    imagesEnabled ? CSP_DIRECTIVES.IMAGES.ENABLED : CSP_DIRECTIVES.IMAGES.DISABLED,
  ].join('; ');

  return (
    <Html>
      <Head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={cspDirectives}
        />
        <style>
          {generateEmailStyles({
            includeFonts: true,
            includeColorSchemes: true,
            includeEmailClient: true,
            includeExternalClass: true,
          })}
        </style>
        <script nonce={nonce}>
          {`
            document.addEventListener('securitypolicyviolation', (e) => {
              window.parent.postMessage({
                type: 'csp-violation',
              }, '*');
            });
          `}
        </script>
      </Head>
      <Body style={{ margin: 0, padding: '20px', background: 'transparent', width: '100%', maxWidth: '100%' }}>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </Body>
    </Html>
  );
};

export const template = async (html: string, imagesEnabled: boolean = false) => {
  if (typeof DOMParser === 'undefined') return html;
  const nonce = generateNonce();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  doc.querySelectorAll('*').forEach((element: Element) => {
    const style = element.getAttribute('style');
    if (style) {
      const newStyle = style
        .replace(/background(-color|-image|-repeat|-position|-size|-attachment)?:[^;]+;?/gi, '')
        .replace(/background:[^;]+;?/gi, '')
        .replace(/color:[^;]+;?/gi, '');
      if (newStyle.trim()) {
        element.setAttribute('style', newStyle);
      } else {
        element.removeAttribute('style');
      }
    }

    const computedStyle = window.getComputedStyle(element);
    const fontFamily = computedStyle.getPropertyValue('font-family');
    if (!fontFamily || fontFamily === 'initial' || fontFamily === 'inherit') {
      element.setAttribute('style', `${element.getAttribute('style') || ''}font-family: ${FONTS.PRIMARY}, ${FONTS.FALLBACK};`);
    }
  });

  doc.body.innerHTML = forceExternalLinks(doc.body.innerHTML);

  if (imagesEnabled) {
    doc.body.innerHTML = proxyImageUrls(doc.body.innerHTML);
  }

  const styles = doc.querySelectorAll('style');
  styles.forEach(style => {
    let cssText = style.textContent || '';
    
    cssText = cssText.replace(/background(-color|-image|-repeat|-position|-size|-attachment)?:[^;{}]+;/gi, '');
    cssText = cssText.replace(/background:[^;{}]+;/gi, '');
    cssText = cssText.replace(/color:[^;{}]+;/gi, '');
    
    cssText = cssText.replace(/([^{]+\{[^}]+)(})/g, (match, p1, p2) => {
      return p1.split(';').map((rule: string) => {
        const ruleLower = rule.toLowerCase();
        if (rule.trim() && !rule.includes('!important') && 
            !ruleLower.includes('background') && 
            !ruleLower.includes('color')) {
          return `${rule.trim()} !important`;
        }
        return rule;
      }).join(';') + p2;
    });
    
    style.textContent = cssText;
  });

  let processedHtml = doc.documentElement.outerHTML;

  const emailHtml = await render(
    <EmailTemplate content={processedHtml} imagesEnabled={imagesEnabled} nonce={nonce} />,
  );
  
  return emailHtml;
};
