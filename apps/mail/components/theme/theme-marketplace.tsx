'use client';

import { Search, Download, Star, Eye, Palette, Filter, Grid3X3, List } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePublicThemes, useCopyTheme } from '@/hooks/use-themes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Theme } from '@/types/theme';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export function ThemeMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: publicThemes, isLoading } = usePublicThemes();
  const copyTheme = useCopyTheme();

  const filteredThemes =
    publicThemes?.themes?.filter(
      (theme) =>
        theme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        theme.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  const handleCopyTheme = async (themeId: string) => {
    try {
      await copyTheme.mutateAsync({ themeId });
      toast.success('Theme copied to your collection');
    } catch (error) {
      toast.error('Failed to copy theme');
    }
  };

  const ThemePreview = ({ theme }: { theme: Theme }) => (
    <div className="space-y-2">
      <div className="f[48;52;178;1768;2848tlex gap-1">
        {Object.entries(theme.colors)
          .slice(0, 6)
          .map(([key, color]) => (
            <div
              key={key}
              className="w-4 h-4 rounded-sm border"
              style={{ backgroundColor: color }}
              title={key}
            />
          ))}
      </div>
      <div className="text-xs text-muted-foreground">
        Font: {theme.typography.fontFamily.split(',')[0]}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container p-6 mx-auto">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-2/3 h-4 rounded bg-muted" />
                <div className="w-full h-3 rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className="w-4 h-4 rounded-sm bg-muted" />
                    ))}
                  </div>
                  <div className="h-8 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Theme Marketplace</h1>
        <p className="text-muted-foreground">
          Discover and install beautiful themes created by the community
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 w-4 h-4 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 w-4 h-4" />
            Filters
          </Button>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Grid/List */}
      {filteredThemes.length === 0 ? (
        <div className="py-12 text-center">
          <Palette className="mx-auto mb-4 w-12 h-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">No themes found</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Try adjusting your search terms' : 'No public themes are available yet'}
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-6',
            viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1',
          )}
        >
          {filteredThemes.map((theme) => (
            <Card key={theme.id} className="transition-all hover:shadow-md group">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{theme.name}</CardTitle>
                    {theme.description && (
                      <CardDescription className="mt-1">{theme.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    Free
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ThemePreview theme={theme} />

                  {/* Stats */}
                  <div className="flex gap-4 items-center text-sm text-muted-foreground">
                    <div className="flex gap-1 items-center">
                      <Download className="w-3 h-3" />0 {/* This would come from the database */}
                    </div>
                    <div className="flex gap-1 items-center">
                      <Star className="w-3 h-3" />0 {/* This would come from the database */}
                    </div>
                    <div className="flex gap-1 items-center">
                      <Eye className="w-3 h-3" />
                      Preview
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => theme.id && handleCopyTheme(theme.id)}
                      disabled={copyTheme.isPending}
                      className="flex-1"
                    >
                      <Download className="mr-2 w-4 h-4" />
                      {copyTheme.isPending ? 'Adding...' : 'Add to Collection'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
