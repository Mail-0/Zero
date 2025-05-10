'use client';

import { usePublicThemes, useThemeActions } from '@/hooks/use-themes';
import { Button } from '@/components/ui/button';
import { ThemePreview } from '@/components/theme/theme-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, Download, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';

export function ThemeMarketplace() {
  const { themes, isLoading, error } = usePublicThemes();
  const { copy } = useThemeActions();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [copying, setCopying] = useState<Record<string, boolean>>({});

  const filteredThemes = themes.filter((theme) => 
    theme.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopy = async (id: string) => {
    setCopying((prev) => ({ ...prev, [id]: true }));
    
    try {
      const result = await copy(id);
      if (result.success) {
        toast.success('Theme copied successfully');
      } else {
        toast.error(result.error || 'Failed to copy theme');
      }
    } catch (error) {
      console.error('Error copying theme:', error);
      toast.error('Failed to copy theme');
    } finally {
      setCopying((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading themes...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error loading themes: {error.message}</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Theme Marketplace</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Browse and copy themes created by the community
        </p>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              placeholder="Search themes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsContent value="grid" className="m-0">
          {filteredThemes.length === 0 ? (
            <div className="p-8 text-center">
              {search ? 'No themes match your search' : 'No public themes available'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredThemes.map((theme) => (
                <Card key={theme.id} className="overflow-hidden transition-all hover:shadow-md">
                  <CardHeader className="p-4">
                    <CardTitle>{theme.name}</CardTitle>
                    <CardDescription>
                      By {theme.userId.substring(0, 8)}...
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="h-32 overflow-hidden rounded border">
                      <div 
                        className="h-full w-full" 
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
                        }}
                        onClick={() => {
                          setSelectedTheme(theme.id);
                          setActiveTab('preview');
                        }}
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
                          Preview Theme
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0 flex justify-between">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedTheme(theme.id);
                        setActiveTab('preview');
                      }}
                    >
                      Preview
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleCopy(theme.id)}
                      disabled={copying[theme.id]}
                    >
                      {copying[theme.id] ? 'Copying...' : (
                        <>
                          <Copy className="mr-2 h-4 w-4" /> Copy Theme
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="preview" className="m-0">
          {selectedTheme ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={() => setActiveTab('grid')}>
                  Back to Grid
                </Button>
                <Button 
                  onClick={() => handleCopy(selectedTheme)}
                  disabled={copying[selectedTheme]}
                >
                  {copying[selectedTheme] ? 'Copying...' : (
                    <>
                      <Copy className="mr-2 h-4 w-4" /> Copy This Theme
                    </>
                  )}
                </Button>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg">
                {themes.find(t => t.id === selectedTheme) && (
                  <ThemePreview settings={themes.find(t => t.id === selectedTheme)!.settings} />
                )}
              </div>
              
              <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-sm">
                <h3 className="text-xl font-bold mb-2">
                  {themes.find(t => t.id === selectedTheme)?.name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  By {themes.find(t => t.id === selectedTheme)?.userId.substring(0, 8)}...
                </p>
                <Button 
                  onClick={() => handleCopy(selectedTheme)}
                  disabled={copying[selectedTheme]}
                  className="w-full"
                >
                  {copying[selectedTheme] ? 'Copying...' : (
                    <>
                      <Copy className="mr-2 h-4 w-4" /> Copy This Theme to My Themes
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              Select a theme to preview
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
} 