import { useState } from 'react';
import ThemeMarketplace from './theme-marketplace';
import { Button } from '@/components/ui/button';

export function useThemeMarketplaceIntegration({ onThemeCopied }: { onThemeCopied: (theme: any) => void }) {
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  // Handler for copying a theme from the marketplace
  async function handleCopyTheme(theme: any) {
    // Call backend to copy theme
    const res = await fetch(`/api/themes/${theme.id}/copy`, { method: 'POST' });
    if (res.ok) {
      const newTheme = await res.json();
      onThemeCopied(newTheme);
    }
    setMarketplaceOpen(false);
  }

  // Marketplace modal component
  const marketplaceModal = (
    <ThemeMarketplace
      open={marketplaceOpen}
      onOpenChange={setMarketplaceOpen}
      onCopy={handleCopyTheme}
    />
  );

  // Button to open the marketplace
  const marketplaceButton = (
    <Button type="button" variant="ghost" className="w-full mt-2" onClick={() => setMarketplaceOpen(true)}>
      Theme Marketplace
    </Button>
  );

  return { marketplaceModal, marketplaceButton };
}
