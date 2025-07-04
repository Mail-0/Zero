import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';
import { ThemeCustomizerModal } from './ThemeCustomizerModal';

export function ThemeManagerModal({
  open,
  onOpenChange,
  connection,
  themes,
  loading,
  onThemeCreated,
  onThemeUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connection: any;
  themes: any[];
  loading?: boolean;
  onThemeCreated: (name: string) => Promise<void>;
  onThemeUpdated: (id: string, name: string, config: any) => Promise<void>;
}) {
  const [themeName, setThemeName] = useState('');
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editingThemeName, setEditingThemeName] = useState('');
  const [customizingTheme, setCustomizingTheme] = useState<any | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showOverlay>
        <DialogHeader>
          <DialogTitle>Themes for {connection.name}</DialogTitle>
          <DialogDescription>Manage and edit your themes for this connection.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6 mt-4">
          <div>
            <div className="flex flex-col gap-3">
              {loading ? (
                <div className="text-muted-foreground text-sm text-center py-8 border rounded bg-muted/50">Loading...</div>
              ) : (Array.isArray(themes) && themes.length === 0) ? (
                <div className="text-muted-foreground text-sm text-center py-8 border rounded bg-muted/50">No themes for this connection.</div>
              ) : (
                (themes || []).map((theme: any) => (
                  <div key={theme.id} className="bg-muted/50 border rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      {editingThemeId === theme.id ? (
                        <input
                          className="border rounded px-2 py-1 text-sm flex-1"
                          value={editingThemeName}
                          onChange={e => setEditingThemeName(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-sm truncate max-w-[180px]">{theme.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingThemeId === theme.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={async () => {
                              await onThemeUpdated(theme.id, editingThemeName, theme.config ?? {});
                              setEditingThemeId(null);
                              setEditingThemeName('');
                            }}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingThemeId(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setEditingThemeId(theme.id); setEditingThemeName(theme.name); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setCustomizingTheme(theme)}>
                            Customize
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="border-t pt-4 mt-2">
            <div className="font-semibold text-base mb-2">Create New Theme</div>
            <div className="flex gap-2 items-center">
              <input
                className="border rounded px-2 py-1 text-sm flex-1"
                placeholder="New theme name"
                value={themeName}
                onChange={e => setThemeName(e.target.value)}
              />
              <Button
                size="sm"
                onClick={async () => {
                  if (!themeName) return;
                  await onThemeCreated(themeName);
                  setThemeName('');
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
        <DialogClose asChild>
          <Button variant="outline" className="mt-6 w-full">Close</Button>
        </DialogClose>
      </DialogContent>
      {customizingTheme && (
        <ThemeCustomizerModal
          open={!!customizingTheme}
          theme={customizingTheme.config}
          onClose={() => setCustomizingTheme(null)}
          onSave={async (customizedTheme: any) => {
            await onThemeUpdated(customizingTheme.id, customizedTheme.name, customizedTheme);
            setCustomizingTheme(null);
          }}
        />
      )}
    </Dialog>
  );
} 