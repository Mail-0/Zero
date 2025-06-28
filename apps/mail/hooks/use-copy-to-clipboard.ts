import { useState } from 'react';
import { toast } from 'sonner';

type ContentType = 'email' | 'link' | 'text';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  
  const copyToClipboard = async (value: string, id: string, contentType: ContentType = 'text'): Promise<boolean> => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      toast.error("Clipboard API not available");
      return false;
    }
    
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(id);
      switch (contentType) {
        case 'email':
          toast.success("Email address copied to clipboard!");
          break;
        case 'link':
          toast.success("Link copied to clipboard!");
          break;
        default:
          toast.success("Copied to clipboard!");
          break;
      }
      
      setTimeout(() => {
        setCopiedValue(null);
      }, resetDelay);
      return true;
    } catch (error) {
      console.error("Failed to copy text to clipboard:", error);
      toast.error("Failed to copy to clipboard");
      return false;
    }
  };
  
  return { copiedValue, copyToClipboard };
}
