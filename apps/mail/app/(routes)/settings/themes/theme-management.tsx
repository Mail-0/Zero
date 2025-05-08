'use client';

import { useState, useEffect } from 'react';
import { useThemeActions } from '@/hooks/use-themes';
import type { ThemeSettings } from '@zero/db/schema';
import { ThemeEditorWithPreview, ThemePreview } from '@/components/theme/theme-editor';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Trash2, ExternalLink, Check, Library } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { useSession } from '@/lib/auth-client';
import { useConnections } from '@/hooks/use-connections';
import { useTRPCClient } from '@/providers/query-provider';
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
  const [isInitializing, setIsInitializing] = useState(initialThemes.length === 0);
  const { data: session, refetch } = useSession();
  const { create, copy, update, remove, initializeDefaults, addPresetThemes, applyToConnection } = useThemeActions();
  const { data: connections, isLoading } = useConnections();
  const { applyThemeSettings } = useCustomTheme();
  const client = useTRPCClient();

  // Create default themes if none exist (after component mounts)
  useEffect(() => {
    const createDefaults = async () => {
      if (initialThemes.length === 0) {
        try {
          setIsInitializing(true);
          const result = await initializeDefaults();
          if (result.success) {
            toast.success('Default themes created successfully');
            // Force reload to show the new themes
            window.location.reload();
          } else {
            toast.error('Failed to create default themes');
          }
        } catch (error) {
          console.error('Error creating default themes:', error);
          toast.error('Failed to create default themes');
        } finally {
          setIsInitializing(false);
        }
      }
    };
    
    createDefaults();
  }, [initialThemes.length, initializeDefaults]);

  // Log session information for debugging
  useEffect(() => {
    if (session) {
      console.log('Session details:', {
        hasSession: !!session,
        userId: session.user?.id,
        connectionId: session.connectionId,
        sessionProperties: Object.keys(session),
        hasActiveConnection: !!session.activeConnection,
        activeConnectionId: session.activeConnection?.id,
      });
    } else {
      console.log('No session available');
    }
  }, [session]);

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
        toast.error('Failed to create theme');
      }
    } catch (error) {
      console.error('Error creating theme:', error);
      toast.error('Failed to create theme');
    }
  };

  const handleUpdateTheme = async (settings: ThemeSettings, name: string, isPublic: boolean) => {
    if (!selectedThemeId || !selectedTheme) return;

    try {
      const updatedThemeData = {
        id: selectedThemeId,
        name,
        settings,
        isPublic,
        connectionId: selectedTheme.connectionId,
      };
      
      // Call the tRPC client to update the theme
      const result = await update(updatedThemeData);

      if (result.success && result.theme) {
        // Update local state
        const updatedThemeForState: Theme = {
          id: selectedThemeId,
          name: result.theme.name,
          settings: result.theme.settings,
          isPublic: result.theme.isPublic,
          connectionId: result.theme.connectionId,
        };
        
        setThemes(prev =>
          prev.map(theme => (theme.id === selectedThemeId ? updatedThemeForState : theme))
        );
        
        setIsEditing(false);
        toast.success('Theme updated successfully');

        // If the updated theme is the currently active one, re-apply its settings visually
        if (selectedTheme.connectionId === session?.connectionId) {
          applyThemeSettings(result.theme.settings);
        }
      } else {
        toast.error('Failed to update theme');
      }
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const handleDeleteTheme = async () => {
    if (!selectedThemeId) return;

    try {
      const themeToDelete = themes.find(t => t.id === selectedThemeId);
      const wasActive = themeToDelete?.connectionId === session?.connectionId;
      
      // Optimistic delete from local state
      setThemes(prev => prev.filter(theme => theme.id !== selectedThemeId));
      setSelectedThemeId(null);
      setDeleteDialogOpen(false);
      
      // Delete on server via tRPC
      const result = await remove(selectedThemeId);
      
      if (result.success) {
        toast.success('Theme deleted successfully');
        
        // If the deleted theme was the active one, apply default settings
        if (wasActive) {
          applyThemeSettings(defaultThemeSettings);
        }
      } else {
        toast.error('Failed to delete theme');
        // Refetch themes to restore correct state
        refreshThemes();
      }
    } catch (error) {
      console.error('Error deleting theme:', error);
      toast.error('Failed to delete theme');
      refreshThemes();
    }
  };

  const refreshThemes = async () => {
    try {
      // Get fresh themes data from the server using tRPC
      const result = await client.themes.getUserThemes.query();
      
      if (result.success) {
        setThemes(result.themes || []);
        toast.success('Themes refreshed');
      } else {
        toast.error('Failed to refresh themes');
      }
    } catch (error) {
      console.error('Error refreshing themes:', error);
      toast.error('Failed to refresh themes');
    }
  };

  const handleApplyTheme = async (themeId: string) => {
    try {
      console.log('Applying theme:', themeId, 'for connection:', session?.connectionId);
      
      if (!session?.connectionId) {
        toast.error('No active connection found. Please select a connection.');
        return;
      }
      
      const result = await applyToConnection(themeId);

      if (result.success && result.theme) {
        const appliedThemeSettings = result.theme.settings as ThemeSettings;
        
        // 1. Apply visually using the context function
        applyThemeSettings(appliedThemeSettings);
        
        // 2. Update local state for the checkmark/button state
        setThemes(prev => 
          prev.map(t => ({
            ...t,
            // Mark the applied theme for the current connection
            connectionId: t.id === themeId ? session.connectionId : 
                          // Unmark any previous theme for this connection
                          (t.connectionId === session.connectionId ? null : t.connectionId)
          }))
        );
        toast.success(`Theme applied successfully to connection: ${session.connectionId.substring(0, 8)}...`);

      } else {
        console.error('Error response from applyToConnection:', result);
        toast.error('Failed to apply theme');
      }
    } catch (error) {
      console.error('Error applying theme:', error);
      toast.error('Failed to apply theme');
    }
  };

  const handleAddPresetThemes = async () => {
    toast.promise(addPresetThemes(), {
      loading: 'Adding preset themes...',
      success: (result) => result.message || 'Preset themes processed.',
      error: (err) => 'Failed to add preset themes.',
    });
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-lg mb-2">Creating default themes...</p>
        <p className="text-sm text-muted-foreground">This will only take a moment</p>
      </div>
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
          <Button variant="outline" onClick={refreshThemes}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
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
                  <div className="flex items-center gap-2">
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
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant={theme.connectionId === session?.connectionId ? "outline" : "default"}
                    onClick={() => handleApplyTheme(theme.id)}
                    disabled={theme.connectionId === session?.connectionId}
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