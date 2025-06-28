import { useState } from 'react';
import { toast } from 'sonner';

export function useCopyToClipboard(resetDelay = 2000) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  
  const copyToClipboard = (value: string, id: string) => {
    navigator.clipboard.writeText(value);
    setCopiedValue(id);
    toast.success("Link copied to clipboard!");
    
    setTimeout(() => {
      setCopiedValue(null);
    }, resetDelay);
  };
  
  return { copiedValue, copyToClipboard };
}

// Simple copy hook without notifications or state management
export function useClipboard() {
  const copy = (text: string): boolean => {
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy text to clipboard:", error);
      return false;
    }
  };

  return { copy };
}
