'use client';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { SettingsCard } from '@/components/settings/settings-card';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { zodResolver } from '@hookform/resolvers/zod';
import { saveUserSettings } from '@/actions/settings';
import { useSettings } from '@/hooks/use-settings';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import DOMPurify from 'dompurify';
import { useImageLoading } from '@/hooks/use-image-loading';

const formSchema = z.object({
  signature: z.object({
    enabled: z.boolean(),
    content: z.string(),
    includeByDefault: z.boolean(),
  }),
});

export default function SignaturesPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const t = useTranslations();
  const { settings, mutate } = useSettings();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      signature: {
        enabled: false,
        content: '',
        includeByDefault: true,
      },
    },
  });

  // Initialize from settings
  useEffect(() => {
    if (settings?.signature) {
      form.reset({
        signature: settings.signature,
      });
      
      // Set the raw HTML in the textarea
      const signatureHtml = settings.signature.content || '';
      setSignatureHtml(signatureHtml);
    }
  }, [form, settings]);

  // Handle updating preview
  useEffect(() => {
    if (!iframeRef.current || !signatureHtml) return;
    
    const iframe = iframeRef.current;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      
      // Use a simplified template
      doc.open();
      const sanitizedHtml = DOMPurify.sanitize(signatureHtml, {
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      });
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, Helvetica, sans-serif;
              padding: 10px;
              margin: 0;
            }
            img {
              max-width: 100%;
            }
          </style>
        </head>
        <body>${sanitizedHtml}</body>
        </html>
      `);
      doc.close();
      
      // More efficient height adjustment
      const adjustHeight = () => {
        if (doc.body) {
          const height = doc.body.scrollHeight + 20;
          iframe.style.height = `${height}px`;
        }
      };
      
      // Adjust height immediately
      adjustHeight();
      
      // Listen for image loads that might affect height
      useImageLoading(doc, adjustHeight);
    } catch (error) {
      console.error('Error updating signature preview:', error);
    }
  }, [signatureHtml]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);

    // Sanitize HTML before saving
    const sanitizedHtml = DOMPurify.sanitize(signatureHtml, {
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    });

    // Use the sanitized HTML from the textarea instead of the form value
    const formData = {
      ...values,
      signature: {
        ...values.signature,
        content: sanitizedHtml
      }
    };

    try {
      // We need to merge with the existing settings
      const updatedSettings = {
        ...settings,
        ...formData,
      };

      await saveUserSettings(updatedSettings);
      await mutate(updatedSettings, { revalidate: false });

      toast.success(t('pages.settings.signatures.signatureSaved'));
    } catch (error) {
      console.error('Failed to save signature settings:', error);
      toast.error(t('common.settings.failedToSave'));
      // Revert the optimistic update
      await mutate();
    } finally {
      setIsSaving(false);
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setSignatureHtml(newValue);
    
    // Update the form state
    form.setValue('signature.content', newValue);
  };

  const watchSignatureEnabled = form.watch('signature.enabled');

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.signatures.title')}
        description={t('pages.settings.signatures.description')}
        footer={
          <Button type="submit" form="signatures-form" disabled={isSaving}>
            {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
          </Button>
        }
      >
        <Form {...form}>
          <form id="signatures-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Enable Signature Switch */}
            <FormField
              control={form.control}
              name="signature.enabled"
              render={({ field }) => (
                <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      {t('pages.settings.signatures.enableSignature')}
                    </FormLabel>
                    <FormDescription>
                      {t('pages.settings.signatures.enableSignatureDescription')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {watchSignatureEnabled && (
              <>
                {/* Include by Default Switch */}
                <FormField
                  control={form.control}
                  name="signature.includeByDefault"
                  render={({ field }) => (
                    <FormItem className="bg-popover flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          {t('pages.settings.signatures.includeByDefault')}
                        </FormLabel>
                        <FormDescription>
                          {t('pages.settings.signatures.includeByDefaultDescription')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Signature HTML Editor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('pages.settings.signatures.signatureContent')}</label>
                  <div className="mt-1">
                    <Textarea
                      ref={textareaRef}
                      className="font-mono text-xs h-[200px]"
                      value={signatureHtml}
                      onChange={handleTextareaChange}
                      placeholder={t('pages.settings.signatures.signatureContentPlaceholder')}
                    />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {t('pages.settings.signatures.signatureContentHelp')}
                  </p>
                </div>

                {/* Signature Preview */}
                {signatureHtml && (
                  <div className="space-y-2">
                    <h3 className="text-base font-medium">
                      {t('pages.settings.signatures.signaturePreview')}
                    </h3>
                    <div className="border p-4 rounded-md">
                      <p className="text-muted-foreground text-sm mb-2">
                        {t('pages.settings.signatures.signaturePreviewDescription')}
                      </p>
                      <div className="border-t pt-2">
                        <iframe
                          ref={iframeRef}
                          className="w-full min-h-[150px] border-0"
                          title="Signature Preview"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        </Form>
      </SettingsCard>
    </div>
  );
}