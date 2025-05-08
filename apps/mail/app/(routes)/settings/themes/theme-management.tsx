'use client';

import { useState } from 'react';
import { useThemeActions } from '@/hooks/use-themes';
import { ThemeSettings } from '@zero/db/schema';
import { ThemeEditorWithPreview, ThemePreview } from '@/components/theme/theme-editor';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Theme {
  id: string;
  name: string;
  settings: ThemeSettings;
  isPublic: boolean;
  connectionId: string | null;
}

interface ThemeManagementProps {
  initialThemes: Theme[];
}

export function ThemeManagement({ initialThemes }: ThemeManagementProps) {
  const [themes, setThemes] = useState<Theme[]>(initialThemes);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { create, copy, initializeDefaults } = useThemeActions();

  const selectedTheme = selectedThemeId ? themes.find(t => t.id === selectedThemeId) : null;

  const handleCreateTheme = async (settings: ThemeSettings, name: string, isPublic: boolean) => {
    try {
      const result = await create({ settings, name, isPublic });
      if (result.success && result.theme) {
        const newTheme: Theme = {
          id: result.theme.id,
          name: result.theme.name,
          settings: result.theme.settings,
          isPublic: result.theme.isPublic,
          connectionId: result.theme.connectionId || null,
        };
        setThemes(prev => [newTheme, ...prev]);
        setIsCreating(false);
        toast.success('Theme created successfully');
      } else {
        toast.error(result.error || 'Failed to create theme');
      }
    } catch (error) {
      console.error('Error creating theme:', error);
      toast.error('Failed to create theme');
    }
  };

  const handleUpdateTheme = async (settings: ThemeSettings, name: string, isPublic: boolean) => {
    if (!selectedThemeId || !selectedTheme) return;

    try {
      const updatedTheme: Theme = {
        id: selectedThemeId,
        name,
        settings,
        isPublic,
        connectionId: selectedTheme.connectionId,
      };
      
      // Optimistic update
      setThemes(prev =>
        prev.map(theme => (theme.id === selectedThemeId ? updatedTheme : theme))
      );
      
      setIsEditing(false);
      toast.success('Theme updated successfully');
      
      // Server update in background - can add error handling if needed
      const result = await fetch(`/api/themes/${selectedThemeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          settings,
          isPublic,
        }),
      });
      
      if (!result.ok) {
        toast.error('Changes may not have been saved to the server');
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const handleDeleteTheme = async () => {
    if (!selectedThemeId) return;

    try {
      // Optimistic delete
      setThemes(prev => prev.filter(theme => theme.id !== selectedThemeId));
      setSelectedThemeId(null);
      setDeleteDialogOpen(false);
      toast.success('Theme deleted successfully');
      
      // Server delete in background
      const result = await fetch(`/api/themes/${selectedThemeId}`, {
        method: 'DELETE',
      });
      
      if (!result.ok) {
        toast.error('Theme may not have been deleted on the server');
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      toast.error('Failed to delete theme');
    }
  };

  if (isCreating) {
    return (
      <div className="space-y-4">
        <ThemeEditorWithPreview 
          onSave={handleCreateTheme} 
          onCancel={() => setIsCreating(false)} 
        />
      </div>
    );
  }

  if (isEditing && selectedTheme) {
    return (
      <div className="space-y-4">
        <ThemeEditorWithPreview 
          initialSettings={selectedTheme.settings}
          initialName={selectedTheme.name}
          isPublic={selectedTheme.isPublic} 
          onSave={handleUpdateTheme}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Your Themes</h3>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreating(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Theme
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/themes/marketplace">
              <ExternalLink className="mr-2 h-4 w-4" /> Theme Marketplace
            </Link>
          </Button>
        </div>
      </div>

      {themes.length === 0 ? (
        <div className="text-center p-8 border rounded-md bg-card">
          <p>You don't have any themes yet.</p>
          <Button onClick={() => setIsCreating(true)} className="mt-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Theme
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => (
            <Card key={theme.id} className="overflow-hidden">
              <div 
                className="h-40 cursor-pointer" 
                style={{ 
                  backgroundColor: theme.settings.colors.background,
                  background: theme.settings.background.type === 'color' 
                    ? theme.settings.background.value 
                    : theme.settings.background.type === 'gradient'
                      ? theme.settings.background.value
                      : `url(${theme.settings.background.value})`,
                  backgroundSize: 'cover',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '1rem',
                }}
                onClick={() => setSelectedThemeId(theme.id === selectedThemeId ? null : theme.id)}
              >
                <div 
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: theme.settings.colors.muted,
                    color: theme.settings.colors.foreground,
                    border: `1px solid ${theme.settings.colors.border}`,
                    fontFamily: theme.settings.fonts.family,
                    boxShadow: `0 0 ${theme.settings.shadows.intensity}px ${theme.settings.shadows.color}`,
                  }}
                >
                  {theme.name}
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">{theme.name}</h4>
                  {theme.isPublic && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                      Public
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setSelectedThemeId(theme.id);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={() => {
                      setSelectedThemeId(theme.id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedThemeId && selectedTheme && !isEditing && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Theme Preview: {selectedTheme.name}</h3>
          <div className="bg-card rounded-lg p-6 border">
            <ThemePreview settings={selectedTheme.settings} />
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the theme. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTheme} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 