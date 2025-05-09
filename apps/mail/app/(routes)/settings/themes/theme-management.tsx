'use client';

import { useState, useEffect } from 'react';
import { useUserThemes, useThemeActions } from '@/hooks/use-themes';
import type { ThemeSettings } from '@zero/db/schema';
import { ThemeEditorWithPreview, ThemePreview } from '@/components/theme/theme-editor';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, ExternalLink, Check, Library, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
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
import { useCustomTheme } from '@/providers/custom-theme-provider';
import { defaultThemeSettings } from '@zero/db/theme_settings_default';
import { EmptyPlaceholder } from '@/components/empty-placeholder';

interface Theme {
  id: string;
  name: string;
  settings: ThemeSettings;
  isPublic: boolean;
  connectionId: string | null;
}

interface ThemeManagementProps {
  initialThemes?: Theme[];
}

export function ThemeManagement({ initialThemes = [] }: ThemeManagementProps) {
  const { 
    themes: fetchedThemes, 
    isLoading: isLoadingThemes, 
    error: themesError, 
    invalidate: invalidateUserThemes 
  } = useUserThemes();
  
  const [themes, setThemes] = useState<Theme[]>(initialThemes);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isInitializingDefaults, setIsInitializingDefaults] = useState(false);
  
  const { data: session } = useSession();
  const { create, update, remove, initializeDefaults, addPresetThemes, applyToConnection } = useThemeActions();
  const { applyThemeSettings } = useCustomTheme();

  useEffect(() => {
    if (!isLoadingThemes && fetchedThemes) {
      setThemes(fetchedThemes);
    }
  }, [fetchedThemes, isLoadingThemes]);

  useEffect(() => {
    const createDefaultsIfNeeded = async () => {
      if (!isLoadingThemes && fetchedThemes && fetchedThemes.length === 0 && !isInitializingDefaults) {
        setIsInitializingDefaults(true);
        try {
          const result = await initializeDefaults();
          if (result.success) {
            toast.success('Default themes created successfully');
          } else {
            toast.error('Failed to create default themes. The server indicated an issue.');
          }
        } catch (error: any) {
          console.error('Error creating default themes:', error);
          toast.error(error.message || 'Failed to create default themes due to an exception.');
        } finally {
          setIsInitializingDefaults(false);
        }
      }
    };
    createDefaultsIfNeeded();
  }, [fetchedThemes, isLoadingThemes, initializeDefaults, isInitializingDefaults]);

  const selectedTheme = selectedThemeId ? themes.find(t => t.id === selectedThemeId) : null;

  const handleCreateTheme = async (settings: ThemeSettings, name: string, isPublic: boolean) => {
    try {
      const result = await create({ settings, name, isPublic });
      if (result.success && result.theme) {
        setIsCreating(false);
        toast.success('Theme created successfully');
      } else {
        toast.error('Failed to create theme. The server indicated an issue.');
      }
    } catch (error: any) {
      console.error('Error creating theme:', error);
      toast.error(error.message || 'Failed to create theme due to an exception.');
    }
  };

  const handleUpdateTheme = async (settings: ThemeSettings, name: string, isPublic: boolean) => {
    if (!selectedThemeId || !selectedTheme) return;
    try {
      const result = await update({
        id: selectedThemeId,
        name,
        settings,
        isPublic,
        connectionId: selectedTheme.connectionId,
      });

      if (result.success && result.theme) {
        setIsEditing(false);
        toast.success('Theme updated successfully');
        if (selectedTheme.connectionId === session?.connectionId) {
          applyThemeSettings(result.theme.settings);
        }
      } else {
        toast.error('Failed to update theme. The server indicated an issue.');
      }
    } catch (error: any) {
      console.error('Error updating theme:', error);
      toast.error(error.message || 'Failed to update theme due to an exception.');
    }
  };

  const handleDeleteTheme = async () => {
    if (!selectedThemeId) return;
    const themeToDelete = themes.find(t => t.id === selectedThemeId);
    const wasActive = themeToDelete?.connectionId === session?.connectionId;

    const previousThemes = themes;
    setThemes(prev => prev.filter(theme => theme.id !== selectedThemeId));
    setSelectedThemeId(null);
    setDeleteDialogOpen(false);

    try {
      const result = await remove(selectedThemeId);
      if (result.success) {
        toast.success('Theme deleted successfully');
        if (wasActive) {
          applyThemeSettings(defaultThemeSettings);
        }
      } else {
        toast.error('Failed to delete theme. The server indicated an issue.');
        setThemes(previousThemes);
      }
    } catch (error: any) {
      console.error('Error deleting theme:', error);
      toast.error(error.message || 'Failed to delete theme due to an exception.');
      setThemes(previousThemes);
    }
  };

  const handleRefreshThemes = () => {
    invalidateUserThemes();
    toast.info('Refreshing themes...');
  };
  
  const handleApplyTheme = async (themeId: string) => {
    if (!session?.connectionId) {
      toast.error('No active connection found. Please select a connection.');
      return;
    }
    try {
      const result = await applyToConnection({ themeId, targetConnectionId: session.connectionId });
      if (result.success && result.theme) {
        applyThemeSettings(result.theme.settings as ThemeSettings);
        toast.success(`Theme applied successfully to connection: ${session.connectionId.substring(0, 8)}...`);
      } else {
        toast.error('Failed to apply theme. The server indicated an issue.');
      }
    } catch (error: any) {
      console.error('Error applying theme:', error);
      toast.error(error.message || 'Failed to apply theme due to an exception.');
    }
  };

  const handleAddPresetThemes = async () => {
    try {
        const promise = addPresetThemes();
        toast.promise(promise, {
            loading: 'Adding preset themes...',
            success: (result: any) => result.message || 'Preset themes processed successfully.',
            error: (err: any) => err.message || 'Failed to add preset themes.',
        });
        await promise; // Ensure we wait for the promise if further actions depend on it
    } catch (error: any) {
        // This catch might be redundant if toast.promise handles all errors,
        // but kept for safety or if direct error handling is needed beyond toast.
        console.error('Error in handleAddPresetThemes:', error);
        toast.error(error.message || 'An unexpected error occurred while adding preset themes.');
    }
  };
  
  if (isLoadingThemes || isInitializingDefaults) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <RefreshCcw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-lg mb-2">{isInitializingDefaults ? 'Initializing default themes...' : 'Loading your themes...'}</p>
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (themesError) {
    return (
      <EmptyPlaceholder>
        <div className="text-center">
          <p className="text-destructive">Error loading themes</p>
          <p className="text-sm text-muted-foreground mt-2">
            {(themesError as Error).message || "We couldn't fetch your themes. Please try refreshing."}
          </p>
          <Button onClick={handleRefreshThemes} className="mt-4">Refresh</Button>
        </div>
      </EmptyPlaceholder>
    );
  }

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Themes</h2>
        <div className="flex gap-2">
          <Button onClick={handleAddPresetThemes} variant="outline">
            <Library className="mr-2 h-4 w-4" />
            Add Preset Themes
          </Button>
          <Button onClick={() => {
            setSelectedThemeId(null);
            setIsCreating(true);
          }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Theme
          </Button>
          <Button variant="outline" onClick={handleRefreshThemes}>
            <RefreshCcw className="h-4 w-4 mr-2" /> 
            Refresh
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/themes/marketplace">
              <ExternalLink className="mr-2 h-4 w-4" /> Theme Marketplace
            </Link>
          </Button>
        </div>
      </div>

      {themes.length === 0 && !isLoadingThemes && !isInitializingDefaults ? (
        <EmptyPlaceholder>
          <div className="text-center">
            <p>You don't have any themes yet.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Try creating a new theme or adding some presets!
            </p>
            <Button onClick={() => setIsCreating(true)} className="mt-4">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Theme
            </Button>
          </div>
        </EmptyPlaceholder>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => (
            <Card key={theme.id} className="overflow-hidden flex flex-col">
              <div 
                className="h-40 cursor-pointer" 
                style={{ 
                  backgroundColor: theme.settings.colors.background,
                  background: theme.settings.background.type === 'color' 
                    ? theme.settings.background.value 
                    : theme.settings.background.type === 'gradient'
                      ? theme.settings.background.value
                      : `url('''${theme.settings.background.value}''')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '1rem',
                }}
                onClick={() => setSelectedThemeId(theme.id === selectedThemeId ? null : theme.id)}
              >
                <div 
                  className="rounded-lg p-3 text-center break-words"
                  style={{
                    backgroundColor: theme.settings.colors.muted,
                    color: theme.settings.colors.foreground,
                    border: `1px solid ${theme.settings.colors.border}`,
                    fontFamily: theme.settings.fonts.family,
                    boxShadow: `0 0 ${theme.settings.shadows.intensity || 0}px ${theme.settings.shadows.color || 'transparent'}`,
                    maxWidth: '90%',
                  }}
                >
                  {theme.name}
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold truncate" title={theme.name}>{theme.name}</h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {theme.connectionId === session?.connectionId && (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 px-2 py-1 rounded-full flex items-center">
                        <Check className="h-3 w-3 mr-1" /> Active
                      </span>
                    )}
                    {theme.isPublic && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Public
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-auto">
                  <Button 
                    size="sm" 
                    variant={theme.connectionId === session?.connectionId ? "outline" : "default"}
                    onClick={() => handleApplyTheme(theme.id)}
                    disabled={theme.connectionId === session?.connectionId || !session?.connectionId}
                    title={!session?.connectionId ? "No active connection to apply theme" : (theme.connectionId === session?.connectionId ? "Theme is already applied to active connection" : "Apply this theme to your active connection")}
                  >
                    {theme.connectionId === session?.connectionId ? (
                      <>
                        <Check className="h-4 w-4 mr-1" /> Applied
                      </>
                    ) : (
                      "Apply Theme"
                    )}
                  </Button>
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
              This will permanently delete the theme "{themes.find(t => t.id === selectedThemeId)?.name || 'this theme'}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTheme} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 