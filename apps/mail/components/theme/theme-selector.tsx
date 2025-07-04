'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useThemes,
  useConnectionTheme,
  useSetConnectionTheme,
  useRemoveConnectionTheme,
  useDeleteTheme,
} from '@/hooks/use-themes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Palette, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeEditor } from './theme-editor';
import { Theme } from '@/types/theme';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface ThemeSelectorProps {
  connectionId: string;
  className?: string;
}

export function ThemeSelector({ connectionId, className }: ThemeSelectorProps) {
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | undefined>();

  const { data: themes } = useThemes();
  const { data: connectionTheme } = useConnectionTheme(connectionId);
  const setConnectionTheme = useSetConnectionTheme();
  const removeConnectionTheme = useRemoveConnectionTheme();
  const deleteTheme = useDeleteTheme();

  const handleSetTheme = async (themeId: string) => {
    try {
      await setConnectionTheme.mutateAsync({
        connectionId,
        themeId,
      });
      toast.success('Theme applied successfully');
    } catch (error) {
      toast.error('Failed to apply theme');
    }
  };

  const handleRemoveTheme = async () => {
    try {
      await removeConnectionTheme.mutateAsync({ connectionId });
      toast.success('Theme removed successfully');
    } catch (error) {
      toast.error('Failed to remove theme');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this theme? This action cannot be undone.',
    );
    if (!confirmDelete) return;
    try {
      await deleteTheme.mutateAsync({ themeId });
      toast.success('Theme deleted successfully');
    } catch (error) {
      toast.error('Failed to delete theme');
    }
  };

  const handleCreateTheme = () => {
    setEditingTheme(undefined);
    setShowThemeEditor(true);
  };

  const handleEditTheme = (theme: Theme) => {
    setEditingTheme(theme);
    setShowThemeEditor(true);
  };

  const currentTheme = connectionTheme?.connectionTheme?.theme;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-2', className)}>
            <Palette className="w-4 h-4" />
            {currentTheme ? currentTheme.name : 'Default Theme'}
            {currentTheme && (
              <Badge variant="secondary" className="ml-1">
                Custom
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Connection Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Default Theme Option */}
          <DropdownMenuItem
            onClick={handleRemoveTheme}
            className={cn('cursor-pointer', !currentTheme && 'bg-accent')}
          >
            <div className="flex gap-2 items-center">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              Default Theme
            </div>
          </DropdownMenuItem>

          {/* User's Custom Themes */}
          {themes?.themes && themes.themes.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Your Themes</DropdownMenuLabel>
              {themes.themes.map((theme) => (
                <div key={theme.id} className="group">
                  <DropdownMenuItem
                    onClick={() => theme.id && handleSetTheme(theme.id)}
                    className={cn(
                      'cursor-pointer pr-8',
                      currentTheme?.id === theme.id && 'bg-accent',
                    )}
                  >
                    <div className="flex flex-1 gap-2 items-center">
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <span className="truncate">{theme.name}</span>
                      {theme.isPublic && (
                        <Badge variant="outline" className="text-xs">
                          Public
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                  <div className="absolute right-2 top-1/2 opacity-0 transition-opacity -translate-y-1/2 group-hover:opacity-100 touch:opacity-100">
                    <div className="flex gap-1">
                      <Button
                        size="default"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTheme(theme);
                        }}
                        className="p-1 min-h-[32px] min-w-[32px]"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          theme.id && handleDeleteTheme(theme.id);
                        }}
                        className="p-0 w-6 h-6 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCreateTheme} className="cursor-pointer">
            <Plus className="mr-2 w-4 h-4" />
            Create New Theme
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Editor Dialog */}
      <Dialog open={showThemeEditor} onOpenChange={setShowThemeEditor}>
        <DialogContent className="p-0 max-w-7xl max-h-[90vh]">
          <DialogDescription className="sr-only">
            {editingTheme ? 'Edit your existing theme' : 'Create a new custom theme'}
          </DialogDescription>
          <ThemeEditor
            theme={editingTheme}
            isEditing={!!editingTheme}
            onSave={() => setShowThemeEditor(false)}
            onCancel={() => setShowThemeEditor(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
