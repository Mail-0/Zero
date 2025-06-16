import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import type { Theme } from '../../../+types/theme';

const defaultTheme: Theme = {
  id: '',
  name: '',
  colors: {
    primary: '#000000',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    foreground: '#0f172a',
    card: '#ffffff',
    cardForeground: '#0f172a',
    popover: '#ffffff',
    popoverForeground: '#0f172a',
    border: '#e2e8f0',
    input: '#e2e8f0',
    ring: '#94a3b8'
  },
  fonts: {
    body: 'inter',
    heading: 'inter',
    mono: 'monospace'
  },
  isPublic: false,
  isDefault: false
};

export default function ThemesPage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [activeTheme, setActiveTheme] = useState<Theme>(defaultTheme);
  const [previewTheme, setPreviewTheme] = useState<Theme>(defaultTheme);
  
  // Fetch user's themes
  const { data: themes = [], isLoading } = useQuery<Theme[]>({
    queryKey: ['themes'],
    queryFn: () => fetch('/api/v1/themes').then(res => res.json())
  });

  // Update preview when active theme changes
  useEffect(() => {
    setPreviewTheme(activeTheme);
  }, [activeTheme]);

  // Create theme mutation
  const createTheme = useMutation({
    mutationFn: (themeData: Partial<Theme>) => 
      fetch('/api/v1/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(themeData)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      toast.success('Theme created successfully');
    }
  });

  // Update theme mutation
  const updateTheme = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Theme> }) =>
      fetch(`/api/v1/themes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      toast.success('Theme updated successfully');
      setActiveTheme(defaultTheme);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Your Themes</h1>
        <div className="flex gap-2">
          <Link to="/settings/themes/marketplace">
            <Button variant="outline">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Theme Marketplace
            </Button>
          </Link>
        </div>
      </div>
      
      {/* Theme List */}
      <div className="grid gap-4">
        <h4 className="text-sm font-medium">Your Themes</h4>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          themes.map((theme) => (
            <div key={theme.id} className="flex items-center justify-between p-4 border rounded-lg" style={{
              fontFamily: theme.fonts?.body || 'system-ui'
            }}>
              <div>
                <p className="font-medium">{theme.name}</p>
                {theme.isPublic && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Public
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
