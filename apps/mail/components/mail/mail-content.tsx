import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { defaultUserSettings } from '@zero/server/schemas';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { m } from '@/paraglide/messages';
import { useTheme } from 'next-themes';
import DOMPurify from 'dompurify';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MailContentProps {
  html: string;
  senderEmail: string;
}

export function MailContent({ html, senderEmail }: MailContentProps) {
  const { data, refetch } = useSettings();
  const queryClient = useQueryClient();
  const isTrustedSender = useMemo(
    () => data?.settings?.externalImages || data?.settings?.trustedSenders?.includes(senderEmail),
    [data?.settings, senderEmail],
  );
  const [cspViolation, setCspViolation] = useState(false);
  const [temporaryImagesEnabled, setTemporaryImagesEnabled] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const { resolvedTheme } = useTheme();
  const trpc = useTRPC();

  const { mutateAsync: saveUserSettings } = useMutation({
    ...trpc.settings.save.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const { mutateAsync: trustSender } = useMutation({
    mutationFn: async () => {
      const existingSettings = data?.settings ?? {
        ...defaultUserSettings,
        timezone: getBrowserTimezone(),
      };

      const { success } = await saveUserSettings({
        ...existingSettings,
        trustedSenders: data?.settings?.trustedSenders
          ? data.settings.trustedSenders.concat(senderEmail)
          : [senderEmail],
      });

      if (!success) {
        throw new Error('Failed to trust sender');
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => {
      toast.error('Failed to trust sender');
    },
  });

  const { data: sanitizedHtml } = useQuery({
    queryKey: ['email-content', html, isTrustedSender || temporaryImagesEnabled, resolvedTheme],
    queryFn: () => {
      const shouldLoadImages = isTrustedSender || temporaryImagesEnabled;

      type Config = Parameters<typeof DOMPurify.sanitize>[1];

      const config: Config = {
        ADD_TAGS: ['style', 'link', 'meta', 'center'],
        ADD_ATTR: [
          'target',
          'style',
          'class',
          'id',
          'href',
          'rel',
          'type',
          'bgcolor',
          'background',
          'color',
          'width',
          'height',
          'align',
          'valign',
          'border',
          'cellpadding',
          'cellspacing',
          'colspan',
          'rowspan',
          'role',
          'aria-label',
          'alt',
          'title',
          'dir',
          'lang',
          'face',
          'size',
        ],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SAFE_FOR_TEMPLATES: true,
        WHOLE_DOCUMENT: false,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        FORCE_BODY: true,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
        IN_PLACE: false,
        ALLOWED_URI_REGEXP: shouldLoadImages
          ? /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
          : /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      };

      if (!shouldLoadImages) {
        DOMPurify.addHook('uponSanitizeElement', (node) => {
          if ((node as HTMLElement).tagName === 'IMG') {
            setCspViolation(true);
            (node as HTMLElement).remove();
          }
        });

        DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
          if (data.attrName === 'style' && data.attrValue?.includes('background-image')) {
            data.attrValue = data.attrValue.replace(/background-image\s*:\s*url\([^)]+\)/gi, '');
            setCspViolation(true);
          }
          if (data.attrName === 'background' && data.attrValue?.startsWith('http')) {
            data.keepAttr = false;
            setCspViolation(true);
          }
        });
      }

      let processedHtml = html;

      const parser = new DOMParser();
      const doc = parser.parseFromString(processedHtml, 'text/html');

      doc.querySelectorAll('a').forEach((link) => {
        if (!link.getAttribute('target')) {
          link.setAttribute('target', '_blank');
        }
        if (!link.getAttribute('rel')?.includes('noopener')) {
          link.setAttribute('rel', 'noopener noreferrer');
        }
      });

      const existingStyles = Array.from(doc.querySelectorAll('style'))
        .map((s) => s.outerHTML)
        .join('\n');

      const existingMeta = Array.from(doc.querySelectorAll('meta'))
        .map((m) => m.outerHTML)
        .join('\n');

      const bodyContent = doc.body.innerHTML;
      const bodyStyles = doc.body.getAttribute('style') || '';
      const bodyBgColor = doc.body.getAttribute('bgcolor') || '';

      const shadowStyles = `
        ${existingMeta}
        <style>
          :host {
            all: initial;
            display: block;
            contain: layout style;
            overflow: auto;
            width: 100%;
            ${
              resolvedTheme === 'dark'
                ? `
              color-scheme: dark;
            `
                : `
              color-scheme: light;
            `
            }
          }

          :host > div.email-wrapper {
            width: 100%;
            height: 100%;
            overflow: auto;
            ${bodyBgColor ? `background-color: ${bodyBgColor};` : ''}
          }

          * {
            box-sizing: border-box;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          table {
            border-collapse: collapse;
          }

          /* Only override link colors if not specified */
          a:not([style*="color"]) {
            color: ${resolvedTheme === 'dark' ? '#60a5fa' : '#2563eb'};
          }

          /* Ensure readability for elements without explicit colors */
          p:not([style*="color"]),
          span:not([style*="color"]),
          div:not([style*="color"]),
          td:not([style*="color"]),
          li:not([style*="color"]) {
            color: inherit;
          }

          /* Handle pre/code blocks that don't have explicit styling */
          pre:not([style*="background"]) {
            background-color: ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
            padding: 0.5rem;
            border-radius: 0.25rem;
            overflow-x: auto;
          }

          code:not([style*="background"]) {
            background-color: ${resolvedTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            padding: 0.125rem 0.25rem;
            border-radius: 0.125rem;
          }
        </style>
        ${existingStyles}
      `;

      const wrapperDiv = `<div class="email-wrapper" ${bodyStyles ? `style="${bodyStyles}"` : ''}>${bodyContent}</div>`;
      const finalHtml = shadowStyles + wrapperDiv;

      try {
        const sanitized = DOMPurify.sanitize(finalHtml, config);
        return sanitized;
      } finally {
        DOMPurify.removeAllHooks();
      }
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!hostRef.current || shadowRootRef.current) return;

    shadowRootRef.current = hostRef.current.attachShadow({ mode: 'open' });
  }, []);

  useEffect(() => {
    if (!shadowRootRef.current || !sanitizedHtml) return;

    shadowRootRef.current.innerHTML = sanitizedHtml as unknown as string;
  }, [sanitizedHtml]);

  useEffect(() => {
    if (isTrustedSender || temporaryImagesEnabled) {
      setCspViolation(false);
    }
  }, [isTrustedSender, temporaryImagesEnabled]);

  const handleImageError = useCallback((e: Event) => {
    const target = e.target as HTMLImageElement;
    if (target.tagName === 'IMG') {
      setCspViolation(true);
      target.style.display = 'none';
    }
  }, []);

  useEffect(() => {
    if (!shadowRootRef.current) return;

    shadowRootRef.current.addEventListener('error', handleImageError, true);

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    };

    shadowRootRef.current.addEventListener('click', handleClick);

    return () => {
      shadowRootRef.current?.removeEventListener('error', handleImageError, true);
      shadowRootRef.current?.removeEventListener('click', handleClick);
    };
  }, [handleImageError, sanitizedHtml]);

  return (
    <>
      {cspViolation && !isTrustedSender && !data?.settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-600/20 px-2 py-1 text-sm text-amber-600">
          <p>{m['common.actions.hiddenImagesWarning']()}</p>
          <button
            onClick={() => setTemporaryImagesEnabled(!temporaryImagesEnabled)}
            className="ml-2 cursor-pointer underline"
          >
            {temporaryImagesEnabled
              ? m['common.actions.disableImages']()
              : m['common.actions.showImages']()}
          </button>
          <button onClick={() => void trustSender()} className="ml-2 cursor-pointer underline">
            {m['common.actions.trustSender']()}
          </button>
        </div>
      )}
      <div
        ref={hostRef}
        className={cn('mail-content w-full flex-1 overflow-hidden', 'min-h-[100px]')}
        style={{ padding: '0' }}
      />
    </>
  );
}
