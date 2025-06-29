'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Download, Star, Eye, Palette, Filter, Grid3X3, List } from 'lucide-react';
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
      <div className="flex gap-1">
        {Object.entries(theme.colors)
          .slice(0, 6)
          .map(([key, color]) => (
            <div
              key={key}
              className="h-4 w-4 rounded-sm border"
              style={{ backgroundColor: color }}
              title={key}
            />
          ))}
      </div>
      <div className="text-muted-foreground text-xs">
        Font: {theme.typography.fontFamily.split(',')[0]}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="bg-muted h-4 w-2/3 rounded" />
                <div className="bg-muted h-3 w-full rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <div key={j} className="bg-muted h-4 w-4 rounded-sm" />
                    ))}
                  </div>
                  <div className="bg-muted h-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Theme Marketplace</h1>
        <p className="text-muted-foreground">
          Discover and install beautiful themes created by the community
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search themes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Theme Grid/List */}
      {filteredThemes.length === 0 ? (
        <div className="py-12 text-center">
          <Palette className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
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
            <Card key={theme.id} className="group transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
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
                  <div className="text-muted-foreground flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />0 {/* This would come from the database */}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />0 {/* This would come from the database */}
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
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
                      <Download className="mr-2 h-4 w-4" />
                      {copyTheme.isPending ? 'Adding...' : 'Add to Collection'}
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4" />
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
