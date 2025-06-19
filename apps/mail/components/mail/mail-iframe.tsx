import { addStyleTags, doesContainStyleTags, template } from '@/lib/email-utils.client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultUserSettings } from '@zero/server/schemas';
import { fixNonReadableColors } from '@/lib/email-utils';
import { useTRPC } from '@/providers/query-provider';
import { getBrowserTimezone } from '@/lib/timezones';
import { useSettings } from '@/hooks/use-settings';
import { useTranslations } from 'use-intl';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function MailIframe({ html, senderEmail }: { html: string; senderEmail: string }) {
  const { data, refetch } = useSettings();
  const queryClient = useQueryClient();
  const isTrustedSender = useMemo(
    () => data?.settings?.externalImages || data?.settings?.trustedSenders?.includes(senderEmail),
    [data?.settings, senderEmail],
  );
  const [cspViolation, setCspViolation] = useState(false);
  const [temporaryImagesEnabled, setTemporaryImagesEnabled] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
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
        trustedSenders: data?.settings.trustedSenders
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

  const { data: processedHtml, isLoading: isProcessingHtml } = useQuery({
    queryKey: ['email-template', html, isTrustedSender || temporaryImagesEnabled],
    queryFn: () => template(html, isTrustedSender || temporaryImagesEnabled),
    staleTime: 30 * 60 * 1000, // Increase cache time to 30 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
  });

  const t = useTranslations();

  const finalHtml = useMemo(() => {
    if (!processedHtml) return '';

    let html = processedHtml;
    const containsStyleTags = doesContainStyleTags(processedHtml);
    if (!containsStyleTags) {
      html = addStyleTags(processedHtml);
    }

    if (!isTrustedSender && !temporaryImagesEnabled) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');
      let hasViolations = false;

      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          hasViolations = true;
          img.removeAttribute('src');
          img.setAttribute('data-blocked-src', src);
          img.style.display = 'none';
        }
      });

      const backgrounds = doc.querySelectorAll('[style*="background"]');
      backgrounds.forEach((el) => {
        const style = el.getAttribute('style') || '';
        if (style.includes('url(') && !style.includes('data:')) {
          hasViolations = true;
          el.setAttribute('style', style.replace(/background[^;]*url\([^)]*\)[^;]*/gi, ''));
        }
      });
      const dangerousElements = doc.querySelectorAll('script, object, embed, form, input, button');
      dangerousElements.forEach((el) => el.remove());

      html = doc.documentElement.outerHTML;
      setCspViolation(hasViolations);
    }

    return html;
  }, [processedHtml, isTrustedSender, temporaryImagesEnabled]);

  useEffect(() => {
    if (!contentRef.current) return;

    requestAnimationFrame(() => {
      if (contentRef.current) {
        fixNonReadableColors(contentRef.current);
      }
    });
  }, [finalHtml]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.backgroundColor =
        resolvedTheme === 'dark' ? 'rgb(10, 10, 10)' : 'rgb(245, 245, 245)';
      requestAnimationFrame(() => {
        if (contentRef.current) {
          fixNonReadableColors(contentRef.current);
        }
      });
    }
  }, [resolvedTheme]);

  // Show loading fallback while processing HTML (similar to HydrateFallback pattern)
  if (isProcessingHtml) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="text-muted-foreground text-sm">Processing email content...</div>
      </div>
    );
  }

  return (
    <>
      {cspViolation && !isTrustedSender && !data?.settings?.externalImages && (
        <div className="flex items-center justify-start bg-amber-600/20 px-2 py-1 text-sm text-amber-600">
          <p>{t('common.actions.hiddenImagesWarning')}</p>
          <button
            onClick={() => setTemporaryImagesEnabled(!temporaryImagesEnabled)}
            className="ml-2 cursor-pointer underline"
          >
            {temporaryImagesEnabled
              ? t('common.actions.disableImages')
              : t('common.actions.showImages')}
          </button>
          <button onClick={() => void trustSender()} className="ml-2 cursor-pointer underline">
            {t('common.actions.trustSender')}
          </button>
        </div>
      )}
      <div
        ref={contentRef}
        className={cn('w-full flex-1 overflow-hidden px-4 transition-opacity duration-200')}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
        style={{
          width: '100%',
          overflow: 'hidden',
        }}
      />
    </>
  );
}
