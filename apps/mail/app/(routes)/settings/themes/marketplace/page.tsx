'use client';

import { useEffect, useState } from 'react';
import { usePublicThemes, useThemeActions } from '@/hooks/use-themes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemePreview } from '@/components/theme/theme-editor';
import { Separator } from '@/components/ui/separator';
import { Copy, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyPlaceholder } from '@/components/empty-placeholder';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

export default function ThemeMarketplacePage() {
  const { themes, isLoading } = usePublicThemes();
  const { copy } = useThemeActions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredThemes, setFilteredThemes] = useState(themes);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredThemes(themes);
    } else {
      setFilteredThemes(
        themes.filter(theme => 
          theme.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, themes]);

  const handleCopyTheme = async (id: string, name: string) => {
    try {
      const result = await copy(id);
      if (result.success) {
        toast.success(`Theme "${name}" copied to your collection`);
      } else {
        toast.error(result.error || 'Failed to copy theme');
      }
    } catch (error) {
      console.error('Error copying theme:', error);
      toast.error('Failed to copy theme');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/settings/themes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="text-2xl font-semibold">Theme Marketplace</h2>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Browse and copy themes created by the community
        </p>
        <div className="w-1/3">
          <Input
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Themes</TabsTrigger>
          <TabsTrigger value="light">Light Themes</TabsTrigger>
          <TabsTrigger value="dark">Dark Themes</TabsTrigger>
          <TabsTrigger value="colorful">Colorful</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="text-center p-12">Loading themes...</div>
          ) : filteredThemes.length === 0 ? (
            <EmptyPlaceholder>
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Copy className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No themes found</h3>
              <p className="mb-4 mt-2 text-center text-sm text-muted-foreground">
                {searchQuery 
                  ? "No themes match your search. Try a different query." 
                  : "There are no public themes available yet."}
              </p>
            </EmptyPlaceholder>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredThemes.map((theme) => (
                <Card key={theme.id} className="overflow-hidden border hover:shadow-md transition-shadow">
                  <div 
                    className="h-40 cursor-pointer relative" 
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
                  >
                    <div 
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: theme.settings.colors.muted,
                        color: theme.settings.colors.foreground,
                        border: `1px solid ${theme.settings.colors.border}`,
                        fontFamily: theme.settings.fonts.family,
                        boxShadow: `0 0 ${theme.settings.shadows.intensity}px ${theme.settings.shadows.color}`,
                        borderRadius: `${theme.settings.cornerRadius}px`,
                      }}
                    >
                      {theme.name}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{theme.name}</h4>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="px-2"
                        onClick={() => handleCopyTheme(theme.id, theme.name)}
                      >
                        <Copy className="h-4 w-4 mr-1" /> Copy
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {Object.entries(theme.settings.colors).slice(0, 5).map(([key, color]) => (
                        <div 
                          key={key}
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: color }}
                          title={`${key}: ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        {/* Content for other tabs would filter the themes accordingly */}
        <TabsContent value="light" className="mt-6">
          {/* Similar to "all" but filtered for light themes */}
        </TabsContent>
        
        <TabsContent value="dark" className="mt-6">
          {/* Similar to "all" but filtered for dark themes */}
        </TabsContent>
        
        <TabsContent value="colorful" className="mt-6">
          {/* Similar to "all" but filtered for colorful themes */}
        </TabsContent>
      </Tabs>
    </div>
  );
} 