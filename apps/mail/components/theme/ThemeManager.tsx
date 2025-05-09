import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useState, useEffect, useContext, createContext } from 'react';
import { useConnections } from '@/hooks/use-connections';
import { ThemeMarketplace } from './ThemeMarketplace';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { ThemeEditor } from './ThemeEditor';

interface ThemeContextValue {
  activeThemeId: string | null;
  setActiveThemeId(id: string): void;
}

// ThemeContext for active theme
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useThemeManager() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeManager must be used within a ThemeManagerProvider');
  }
  return context;
}

export function ThemeManagerProvider({ children }: { children: React.ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const { data: session } = useSession();
  const { data: connections } = useConnections();

  // Fetch all user themes once for context
  useEffect(() => {
    fetch('/api/v1/themes')
      .then((res) => res.json())
      .then((data) => setThemes(Array.isArray(data) ? data : []));
  }, []);

  // Load themeId from active connection
  useEffect(() => {
    if (!session?.connectionId || !connections) return;
    const activeConn = connections.find((c: any) => c.id === session.connectionId);
    if (activeConn?.themeId) {
      setActiveThemeId(activeConn.themeId);
      localStorage.setItem('activeThemeId', activeConn.themeId);
    }
  }, [session?.connectionId, connections]);

  const setActive = async (id: string) => {
    setActiveThemeId(id);
    localStorage.setItem('activeThemeId', id);
    // Persist to backend for current connection
    if (session?.connectionId) {
      await fetch(`/api/driver/connections?connectionId=${session.connectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId: id }),
      });
    }
  };

  // Apply theme as CSS variables
  useEffect(() => {
    if (!activeThemeId || !themes.length) return;
    const theme = themes.find((t) => t.id === activeThemeId);
    if (!theme) return;
    const root = document.documentElement;
    // Set color variables
    Object.entries(theme.colors || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-color-${key}`, value as string);
    });
    // Set background variables
    Object.entries(theme.backgrounds ?? {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-bg-${key}`, value as string);
    });
    // Set font variables
    Object.entries(theme.fonts || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-font-${key}`, value as string);
    });
    // Set spacing
    Object.entries(theme.spacing || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-spacing-${key}`, value + 'px');
    });
    // Set radius
    Object.entries(theme.radius || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-radius-${key}`, value + 'px');
    });
    // Set shadows
    Object.entries(theme.shadows || {}).forEach(([key, value]) => {
      root.style.setProperty(`--theme-shadow-${key}`, `0 2px ${value}px rgba(0,0,0,0.2)`);
    });
    return () => {
      // Clean up variables
      Object.keys(theme.colors || {}).forEach((key) => {
        root.style.removeProperty(`--theme-color-${key}`);
      });
      Object.keys(theme.fonts || {}).forEach((key) => {
        root.style.removeProperty(`--theme-font-${key}`);
      });
      Object.keys(theme.spacing || {}).forEach((key) => {
        root.style.removeProperty(`--theme-spacing-${key}`);
      });
      Object.keys(theme.radius || {}).forEach((key) => {
        root.style.removeProperty(`--theme-radius-${key}`);
      });
      Object.keys(theme.shadows || {}).forEach((key) => {
        root.style.removeProperty(`--theme-shadow-${key}`);
      });
    };
  }, [activeThemeId, themes]);

  return (
    <ThemeContext.Provider value={{ activeThemeId, setActiveThemeId: setActive }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeManager() {
  const [open, setOpen] = useState(false);
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<any | null>(null);
  const [editorKey, setEditorKey] = useState(0); // To force re-mount ThemeEditor
  const [tab, setTab] = useState<'my' | 'marketplace'>('my');
  const { activeThemeId, setActiveThemeId } = useThemeManager() || {};

  // Fetch user themes
  useEffect(() => {
    if (!open || tab !== 'my') return;
    setLoading(true);
    fetch('/api/v1/themes')
      .then((res) => res.json())
      .then((data) => setThemes(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [open, tab]);

  // Handle opening editor for new or existing theme
  const handleEditTheme = (theme: any | null) => {
    setSelectedTheme(theme);
    setEditorKey((k) => k + 1); // Force re-mount
  };

  // After save/close, refresh list
  const handleEditorClose = () => {
    setSelectedTheme(null);
    setOpen(false);
    setTimeout(() => setOpen(true), 10); // Reopen to trigger useEffect
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Manage Themes</Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-3xl">
        <DialogHeader>
          <DialogTitle>Theme Manager</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab as any} className="mt-2">
          <TabsList className="mb-4">
            <TabsTrigger value="my">My Themes</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>
          <TabsContent value="my">
            {/* Theme List */}
            {!selectedTheme && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-lg font-semibold">Your Themes</div>
                  <Button size="sm" onClick={() => handleEditTheme(null)}>
                    + New Theme
                  </Button>
                </div>
                {loading ? (
                  <div>Loading...</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {themes.map((theme) => (
                      <div
                        key={theme.id}
                        className={`hover:bg-muted flex cursor-pointer items-center gap-4 rounded-lg border p-3 ${activeThemeId === theme.id ? 'border-yellow-400 ring-2 ring-yellow-300' : ''}`}
                        onClick={() => handleEditTheme(theme)}
                      >
                        <div className="flex gap-1">
                          {Object.values(theme.colors)
                            .slice(0, 3)
                            .map((color: string, i: number) => (
                              <span
                                key={i}
                                className="h-5 w-5 rounded-full border"
                                style={{ background: color }}
                              />
                            ))}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{theme.name}</div>
                          <div className="text-muted-foreground text-xs">{theme.fonts?.body}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={activeThemeId === theme.id ? 'default' : 'outline'}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveThemeId && setActiveThemeId(theme.id);
                          }}
                          disabled={activeThemeId === theme.id}
                        >
                          {activeThemeId === theme.id ? 'Active' : 'Set as Active'}
                        </Button>
                      </div>
                    ))}
                    {themes.length === 0 && (
                      <div className="text-muted-foreground">No themes yet.</div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Theme Editor */}
            {selectedTheme !== null && (
              <ThemeEditor
                key={editorKey}
                onClose={handleEditorClose}
                initialTheme={selectedTheme}
              />
            )}
          </TabsContent>
          <TabsContent value="marketplace">
            <ThemeMarketplace />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
