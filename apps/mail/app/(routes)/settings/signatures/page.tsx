'use client';
// DEPRECATED - 
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
import Editor from '@/components/create/editor';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { SignaturePreview } from '@/components/mail/signature-preview';
import { JSONContent } from 'novel';

const formSchema = z.object({
  signature: z.object({
    enabled: z.boolean(),
    content: z.string().min(1).max(10000),
    includeByDefault: z.boolean(),
    editorType: z.enum(['plain', 'rich']).default('plain'),
  }),
});

export default function SignaturesPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState('');
  const [editorContent, setEditorContent] = useState<JSONContent | undefined>(undefined);
  // Using autofocus instead of a ref for better user experience
  const [autoFocus, setAutoFocus] = useState(false);
  const t = useTranslations();
  const { settings, mutate } = useSettings();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      signature: {
        enabled: false,
        content: '--<br><br>Sent via <a href="https://0.email" target="_blank" style="color: #016FFE; text-decoration: none;">0.email</a>',
        includeByDefault: true,
        editorType: 'plain',
      },
    },
  });

  // Helper function to convert HTML to JSONContent more accurately
  const tryParseHtmlToContent = (html: string): JSONContent | undefined => {
    try {
      // Create a temporary div to parse the HTML
      const div = document.createElement('div');
      div.innerHTML = html;
      
      // Return as a document with proper structure preserving paragraphs
      // This is a basic implementation - for more complex conversions, consider using a 
      // dedicated HTML-to-ProseMirror conversion library
      const content: any[] = [];
      
      // Process each child element to create proper paragraph nodes
      Array.from(div.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          // Plain text nodes
          if (node.textContent?.trim()) {
            content.push({
              type: 'paragraph',
              content: [{ type: 'text', text: node.textContent }]
            });
          }
        } else if (node.nodeName === 'BR') {
          // Line breaks - add an empty paragraph
          content.push({ type: 'paragraph' });
        } else if (node.nodeName === 'P' || node.nodeName === 'DIV') {
          // Paragraph or div elements
          content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: node.textContent || '' }]
          });
        } else {
          // Other elements - try to preserve their content
          content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: node.textContent || '' }]
          });
        }
      });
      
      // If no content was created, create a default empty paragraph
      if (content.length === 0) {
        content.push({ type: 'paragraph' });
      }
      
      return {
        type: 'doc',
        content
      };
    } catch (error) {
      console.error('Error parsing HTML to content:', error);
      return undefined;
    }
  };

  // Initialize from settings
  useEffect(() => {
    if (settings?.signature) {
      // Initialize with editorType defaulting to 'plain' for existing users
      form.reset({
        signature: {
          ...settings.signature,
          editorType: settings.signature.editorType || 'plain',
        },
      });
      
      // Set the raw HTML in the state
      const signatureHtml = settings.signature.content || '--<br><br>Sent via <a href="https://0.email" target="_blank" style="color: #016FFE; text-decoration: none;">0.email</a>';
      setSignatureHtml(signatureHtml);
      
      // Attempt to parse HTML to JSONContent for the rich editor
      // This is a simple approach - a more robust solution would use a proper HTML to ProseMirror converter
      setEditorContent(tryParseHtmlToContent(signatureHtml));
    } else {
      // For new users with no signature settings yet, set the default content
      const defaultSignature = '--<br><br>Sent via <a href="https://0.email" target="_blank" style="color: #016FFE; text-decoration: none;">0.email</a>';
      setSignatureHtml(defaultSignature);
      setEditorContent(tryParseHtmlToContent(defaultSignature));
    }
  }, [form, settings]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    
    // Get the content based on editor type
    let contentToSave = signatureHtml;
    
    // Sanitize HTML before saving
    const sanitizedHtml = DOMPurify.sanitize(contentToSave, {
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    });

    // Use the sanitized HTML
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
    // Try to clean any malformed HTML
    const cleanedValue = decodeHtmlEntities(newValue);
    setSignatureHtml(cleanedValue);
    
    // Update the form state
    form.setValue('signature.content', cleanedValue);
  };

  const handleEditorChange = (html: string) => {
    // Process the HTML coming from the rich editor
    setSignatureHtml(html);
    
    // Update the form state
    form.setValue('signature.content', html);
  };

  const watchSignatureEnabled = form.watch('signature.enabled');
  const watchEditorType = form.watch('signature.editorType');
  
  // Function to decode HTML entities
  const decodeHtmlEntities = (html: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };
  
  // Handle switching between editor types
  useEffect(() => {
    // When switching editor modes
    if (watchEditorType === 'rich') {
      // Clean any double-escaped HTML before loading into rich editor
      const cleanHtml = decodeHtmlEntities(signatureHtml);
      setSignatureHtml(cleanHtml);
      setEditorContent(tryParseHtmlToContent(cleanHtml));
      setAutoFocus(false);
    } else {
      // When switching to plain mode, make sure we're seeing actual HTML, not escaped entities
      const cleanHtml = decodeHtmlEntities(signatureHtml);
      setSignatureHtml(cleanHtml);
      setAutoFocus(true);
    }
  }, [watchEditorType]);

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

                {/* Editor Type Selector - Improved UI */}
                <div className="space-y-2">
                  <FormLabel>{t('pages.settings.signatures.editorType')}</FormLabel>
                  <div className="flex space-x-2">
                    <Button
                      type="button"
                      variant={watchEditorType === 'plain' ? 'default' : 'outline'}
                      onClick={() => form.setValue('signature.editorType', 'plain')}
                      className="flex-1"
                    >
                      <code className="mr-2">&lt;/&gt;</code>
                      {t('pages.settings.signatures.plainText')}
                    </Button>
                    <Button
                      type="button"
                      variant={watchEditorType === 'rich' ? 'default' : 'outline'}
                      onClick={() => form.setValue('signature.editorType', 'rich')}
                      className="flex-1"
                    >
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                          <path d="M12 10v4" />
                          <line x1="9" y1="6" x2="15" y2="6" />
                          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
                          <path d="M12 3v7" />
                          <path d="M10 16h4" />
                        </svg>
                      </span>
                      {t('pages.settings.signatures.richText')}
                    </Button>
                  </div>
                  <FormDescription>
                    {t('pages.settings.signatures.editorTypeDescription')}
                  </FormDescription>
                </div>

                {/* Signature Editor - either plain text or rich editor */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('pages.settings.signatures.signatureContent')}</label>
                  
                  {watchEditorType === 'plain' ? (
                    <div className="mt-1">
                      <Textarea
                        autoFocus={autoFocus}
                        className="font-mono text-xs h-[200px]"
                        value={signatureHtml}
                        onChange={handleTextareaChange}
                        placeholder={t('pages.settings.signatures.signatureContentPlaceholder')}
                      />
                      <p className="text-muted-foreground text-sm mt-2">
                        {t('pages.settings.signatures.signatureContentHelp') || "You can use HTML to add formatting, links, and images to your signature."}
                      </p>
                      <div className="text-xs bg-muted/50 p-2 mt-1 rounded border">
                        <strong>Note:</strong> HTML tags are supported for formatting. 
                        For security reasons, script tags are not allowed. Common useful tags: 
                        <code className="mx-1 px-1 bg-muted rounded">&lt;a&gt;</code> for links, 
                        <code className="mx-1 px-1 bg-muted rounded">&lt;br&gt;</code> for line breaks, 
                        <code className="mx-1 px-1 bg-muted rounded">&lt;b&gt;</code> for bold text.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 border rounded-md p-2">
                      <Editor
                        initialValue={editorContent}
                        onChange={handleEditorChange}
                        placeholder={t('pages.settings.signatures.richTextPlaceholder') || "Format your signature with the rich text editor..."}
                        className="w-full"
                        autoFocus
                      />
                      <p className="text-muted-foreground text-sm mt-2">
                        {t('pages.settings.signatures.richTextDescription')}
                      </p>
                    </div>
                  )}
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
                        <SignaturePreview
                          html={signatureHtml}
                          className="w-full min-h-[150px]"
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