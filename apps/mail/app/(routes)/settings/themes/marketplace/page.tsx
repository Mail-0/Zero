'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpcClient } from '@/providers/query-provider';
import type { ServerTheme } from '@/types/theme';
// Use the correct import for Link in your project

export default function ThemeMarketplacePage() {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [selectedTheme, setSelectedTheme] = useState<ServerTheme | null>(null);
  const [newThemeName, setNewThemeName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch public themes
  const { data: publicThemes = [], isLoading } = useQuery<ServerTheme[]>({
    queryKey: ['public-themes'],
    queryFn: async () => {
      return await trpcClient.theme.getThemes.query({ publicOnly: true });
    },
  });

  // Copy theme mutation
  const { mutate: copyTheme, isPending } = useMutation({
    mutationFn: async ({ themeId, newName }: { themeId: string; newName: string }) => {
      return await fetch('/api/v1/themes/copy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ themeId, newName }),
      }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['themes'] });
      toast.success('Theme copied successfully');
      setDialogOpen(false);
      setNewThemeName('');
    },
    onError: () => {
      toast.error('Failed to copy theme');
    },
  });

  const handleCopyTheme = () => {
    if (!selectedTheme || !newThemeName.trim()) return;
    
    copyTheme({
      themeId: selectedTheme.id,
      newName: newThemeName.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Theme Marketplace</h1>
      </div>
      
      <p className="text-muted-foreground">
        Browse and use themes created by other users.
      </p>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : publicThemes.length === 0 ? (
        <div className="text-center p-8 border rounded-lg">
          <p>No public themes available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {publicThemes.map((theme) => (
            <Card key={theme.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle>{theme.name}</CardTitle>
                <CardDescription>Created by {theme.userId}</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="h-24 w-full rounded-md mb-4" 
                  style={{ backgroundColor: theme.colors.primary }}
                ></div>
                <div className="flex gap-2">
                  <div 
                    className="h-8 w-8 rounded-full" 
                    style={{ backgroundColor: theme.colors.primary }}
                  ></div>
                  <div 
                    className="h-8 w-8 rounded-full" 
                    style={{ backgroundColor: theme.colors.background }}
                  ></div>
                  <div 
                    className="h-8 w-8 rounded-full" 
                    style={{ backgroundColor: theme.colors.card }}
                  ></div>
                </div>
              </CardContent>
              <CardFooter>
                <Dialog open={dialogOpen && selectedTheme?.id === theme.id} onOpenChange={(open) => {
                  setDialogOpen(open);
                  if (!open) setSelectedTheme(null);
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={() => {
                        setSelectedTheme(theme);
                        setNewThemeName(`Copy of ${theme.name}`);
                        setDialogOpen(true);
                      }}
                      className="w-full"
                    >
                      Use This Theme
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Copy Theme</DialogTitle>
                      <DialogDescription>
                        Enter a name for your copy of this theme.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Input
                        value={newThemeName}
                        onChange={(e) => setNewThemeName(e.target.value)}
                        placeholder="Theme name"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleCopyTheme} disabled={isPending || !newThemeName.trim()}>
                        {isPending ? 'Copying...' : 'Copy Theme'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}