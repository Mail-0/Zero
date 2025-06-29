'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Type, Square, Sparkles, Layers, Eye, Save, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Theme, defaultTheme, googleFonts, GoogleFont } from '@/types/theme';
import { useCreateTheme, useUpdateTheme } from '@/hooks/use-themes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThemeEditorProps {
  theme?: Theme;
  onSave?: (theme: Theme) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

export function ThemeEditor({ theme, onSave, onCancel, isEditing = false }: ThemeEditorProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme || defaultTheme);
  const [previewMode, setPreviewMode] = useState(false);

  const createTheme = useCreateTheme();
  const updateTheme = useUpdateTheme();

  useEffect(() => {
    if (theme) {
      setCurrentTheme(theme);
    }
  }, [theme]);

  // Apply theme to preview
  useEffect(() => {
    if (previewMode) {
      applyThemeToDocument(currentTheme);
    } else {
      resetThemeToDefault();
    }

    return () => {
      resetThemeToDefault();
    };
  }, [currentTheme, previewMode]);

  const applyThemeToDocument = (theme: Theme) => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      // Validate key contains only alphanumeric characters and hyphens
      const sanitizedKey = key.replace(/[^a-zA-Z0-9-]/g, '');
      const cssVar = `--${sanitizedKey.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Apply font
    if (theme.typography.fontFamily !== 'Inter, system-ui, sans-serif') {
      const fontLink = document.getElementById('google-font');
      if (fontLink) {
        fontLink.remove();
      }

      const link = document.createElement('link');
      link.id = 'google-font';
      const fontName = encodeURIComponent(theme.typography.fontFamily.split(',')[0].trim());
      link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@100;300;400;500;600;700;800&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      root.style.setProperty('--font-family', theme.typography.fontFamily);
    }
  };

  const resetThemeToDefault = () => {
    const root = document.documentElement;
    Object.keys(defaultTheme.colors).forEach((key) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.removeProperty(cssVar);
    });

    root.style.removeProperty('--font-family');

    const fontLink = document.getElementById('google-font');
    if (fontLink) {
      fontLink.remove();
    }
  };

  const handleSave = async () => {
    try {
      if (isEditing && currentTheme.id) {
        await updateTheme.mutateAsync({
          themeId: currentTheme.id,
          data: currentTheme,
        });
        toast.success('Theme updated successfully');
      } else {
        await createTheme.mutateAsync(currentTheme);
        toast.success('Theme created successfully');
      }
      onSave?.(currentTheme);
    } catch (error) {
      toast.error('Failed to save theme');
    }
  };

  const updateThemeProperty = (section: keyof Theme, property: string, value: any) => {
    setCurrentTheme((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [property]: value,
      },
    }));
  };

  const updateNestedProperty = (
    section: keyof Theme,
    subsection: string,
    property: string,
    value: any,
  ) => {
    setCurrentTheme((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...(prev[section] as any)[subsection],
          [property]: value,
        },
      },
    }));
  };

  const ColorInput = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <div
          className="w-10 h-10 rounded border-2 border-gray-300 cursor-pointer"
          style={{ backgroundColor: value }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = value.includes('hsl') ? '#000000' : value;
            input.onchange = (e) => onChange((e.target as HTMLInputElement).value);
            input.click();
          }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
          placeholder="hsl(240 5.9% 10%)"
        />
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Editor Panel */}
      <div className="w-1/2 border-r">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">{isEditing ? 'Edit Theme' : 'Create Theme'}</h2>
              <p className="text-sm text-muted-foreground">Customize colors, fonts, and styles</p>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
                className={cn(previewMode && 'bg-primary text-primary-foreground')}
              >
                <Eye className="mr-2 w-4 h-4" />
                {previewMode ? 'Exit Preview' : 'Preview'}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-6 space-y-6">
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex gap-2 items-center">
                  <Sparkles className="w-4 h-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme Name</Label>
                  <Input
                    value={currentTheme.name}
                    onChange={(e) => setCurrentTheme((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="My Custom Theme"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={currentTheme.description || ''}
                    onChange={(e) =>
                      setCurrentTheme((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="A beautiful theme for..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={currentTheme.isPublic}
                    onCheckedChange={(checked) =>
                      setCurrentTheme((prev) => ({ ...prev, isPublic: checked }))
                    }
                  />
                  <Label>Make public (show in marketplace)</Label>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="colors">
                  <Palette className="mr-2 w-4 h-4" />
                  Colors
                </TabsTrigger>
                <TabsTrigger value="typography">
                  <Type className="mr-2 w-4 h-4" />
                  Typography
                </TabsTrigger>
                <TabsTrigger value="spacing">
                  <Square className="mr-2 w-4 h-4" />
                  Spacing
                </TabsTrigger>
                <TabsTrigger value="shadows">
                  <Layers className="mr-2 w-4 h-4" />
                  Shadows
                </TabsTrigger>
                <TabsTrigger value="radius">
                  <RefreshCw className="mr-2 w-4 h-4" />
                  Radius
                </TabsTrigger>
              </TabsList>

              {/* Colors Tab */}
              <TabsContent value="colors" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Color Palette</CardTitle>
                    <CardDescription>Customize the color scheme of your theme</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <ColorInput
                      label="Primary"
                      value={currentTheme.colors.primary}
                      onChange={(value) => updateThemeProperty('colors', 'primary', value)}
                    />
                    <ColorInput
                      label="Primary Foreground"
                      value={currentTheme.colors.primaryForeground}
                      onChange={(value) =>
                        updateThemeProperty('colors', 'primaryForeground', value)
                      }
                    />
                    <ColorInput
                      label="Secondary"
                      value={currentTheme.colors.secondary}
                      onChange={(value) => updateThemeProperty('colors', 'secondary', value)}
                    />
                    <ColorInput
                      label="Secondary Foreground"
                      value={currentTheme.colors.secondaryForeground}
                      onChange={(value) =>
                        updateThemeProperty('colors', 'secondaryForeground', value)
                      }
                    />
                    <ColorInput
                      label="Background"
                      value={currentTheme.colors.background}
                      onChange={(value) => updateThemeProperty('colors', 'background', value)}
                    />
                    <ColorInput
                      label="Foreground"
                      value={currentTheme.colors.foreground}
                      onChange={(value) => updateThemeProperty('colors', 'foreground', value)}
                    />
                    <ColorInput
                      label="Muted"
                      value={currentTheme.colors.muted}
                      onChange={(value) => updateThemeProperty('colors', 'muted', value)}
                    />
                    <ColorInput
                      label="Muted Foreground"
                      value={currentTheme.colors.mutedForeground}
                      onChange={(value) => updateThemeProperty('colors', 'mutedForeground', value)}
                    />
                    <ColorInput
                      label="Accent"
                      value={currentTheme.colors.accent}
                      onChange={(value) => updateThemeProperty('colors', 'accent', value)}
                    />
                    <ColorInput
                      label="Accent Foreground"
                      value={currentTheme.colors.accentForeground}
                      onChange={(value) => updateThemeProperty('colors', 'accentForeground', value)}
                    />
                    <ColorInput
                      label="Border"
                      value={currentTheme.colors.border}
                      onChange={(value) => updateThemeProperty('colors', 'border', value)}
                    />
                    <ColorInput
                      label="Input"
                      value={currentTheme.colors.input}
                      onChange={(value) => updateThemeProperty('colors', 'input', value)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Typography Tab */}
              <TabsContent value="typography" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Typography</CardTitle>
                    <CardDescription>Choose fonts and text styling</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Font Family</Label>
                      <Select
                        value={currentTheme.typography.fontFamily.split(',')[0]}
                        onValueChange={(value) =>
                          updateThemeProperty(
                            'typography',
                            'fontFamily',
                            `${value}, system-ui, sans-serif`,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {googleFonts.map((font) => (
                            <SelectItem key={font} value={font}>
                              <span style={{ fontFamily: font }}>{font}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Other tabs can be implemented similarly */}
              <TabsContent value="spacing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Spacing</CardTitle>
                    <CardDescription>Adjust spacing and layout</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Spacing controls coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shadows" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Shadows</CardTitle>
                    <CardDescription>Configure shadow effects</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Shadow controls coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="radius" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Border Radius</CardTitle>
                    <CardDescription>Adjust corner roundness</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Border radius controls coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="p-6 border-t bg-background">
          <div className="flex justify-between">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createTheme.isPending || updateTheme.isPending}>
              <Save className="mr-2 w-4 h-4" />
              {createTheme.isPending || updateTheme.isPending ? 'Saving...' : 'Save Theme'}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-1/2">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Live Preview</h3>
          <p className="text-sm text-muted-foreground">See how your theme looks in real-time</p>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sample Card</CardTitle>
                <CardDescription>This is how your theme affects components</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button>Primary Button</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                </div>
                <Input placeholder="Sample input field" />
                <div className="flex items-center space-x-2">
                  <Switch />
                  <Label>Toggle switch</Label>
                </div>
                <div className="flex gap-2">
                  <Badge>Badge</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
