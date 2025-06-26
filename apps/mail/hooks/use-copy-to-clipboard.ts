import { useState } from 'react';
import { toast } from 'sonner';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  
  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (err) {
      console.error('Fallback copy failed', err);
      return false;
    }
  };

  const copyToClipboard = async (value: string, id?: string) => {
    if (value === '') return;

    let copied = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        copied = true;
      } catch (err) {
        console.warn('navigator.clipboard.writeText failed, falling back', err);
      }
    }

    if (!copied) {
      copied = fallbackCopy(value);
    }

    if (copied) {
      setCopiedValue(id ?? value);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedValue(null), resetDelay);
    } else {
      toast.error('Failed to copy');
    }
  };
  
  return { copiedValue, copyToClipboard };
} 