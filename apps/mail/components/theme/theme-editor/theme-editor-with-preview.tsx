'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeSettings } from '@zero/db/schema';
import { defaultThemeSettings } from '@zero/db/theme_settings_default';
import { ChromePicker } from 'react-color';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, X, Code, ArrowLeft, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { ThemePreview } from './theme-preview';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const googleFonts = [
  { name: 'Roboto', weights: ['300', '400', '500', '700'] },
  { name: 'Open Sans', weights: ['300', '400', '600', '700'] },
  { name: 'Lato', weights: ['300', '400', '700'] },
  { name: 'Montserrat', weights: ['300', '400', '500', '600', '700'] },
  { name: 'Oswald', weights: ['300', '400', '500', '600', '700'] },
  { name: 'Source Sans Pro', weights: ['300', '400', '600', '700'] },
  { name: 'Raleway', weights: ['300', '400', '500', '600', '700'] },
  { name: 'Poppins', weights: ['300', '400', '500', '600', '700'] },
  { name: 'Noto Sans', weights: ['400', '700'] },
  { name: 'Ubuntu', weights: ['300', '400', '500', '700'] },
  // Add more fonts as desired
];

interface ThemeEditorWithPreviewProps {
  initialSettings?: ThemeSettings;
  initialName?: string;
  isPublic?: boolean;
  onSave: (settings: ThemeSettings, name: string, isPublic: boolean) => Promise<void>;
  onCancel?: () => void;
}

export function ThemeEditorWithPreview({
  initialSettings = defaultThemeSettings,
  initialName = 'My Custom Theme',
  isPublic = false,
  onSave,
  onCancel,
}: ThemeEditorWithPreviewProps) {
  const [settings, setSettings] = useState<ThemeSettings>(initialSettings);
  const [name, setName] = useState(initialName);
  const [publicTheme, setPublicTheme] = useState(isPublic);
  const [activeTab, setActiveTab] = useState('colors');
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [codeView, setCodeView] = useState(false);

  // Reset to initial values if they change
  useEffect(() => {
    setSettings(initialSettings);
    setName(initialName);
    setPublicTheme(isPublic);
  }, [initialSettings, initialName, isPublic]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a theme name');
      return;
    }

    setSaving(true);
    try {
      await onSave(settings, name, publicTheme);
      toast.success('Theme saved successfully');
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSettings(initialSettings);
    toast.success('Reset to original settings');
  };

  const updateColor = (key: string, color: string) => {
    setSettings((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: color,
      },
    }));
  };

  const updateFont = (key: string, value: any) => {
    const processedValue = key === 'family' ? value : Number(value) || 0;
    setSettings((prev) => ({
      ...prev,
      fonts: {
        ...prev.fonts,
        [key]: processedValue,
      },
    }));
  };

  const updateSpacing = (key: string, value: number) => {
    // Ensure value is a number with fallback to 0
    const processedValue = typeof value === 'number' ? value : 0;
    setSettings((prev) => ({
      ...prev,
      spacing: {
        ...prev.spacing,
        [key]: processedValue,
      },
    }));
  };

  const updateShadows = (key: string, value: any) => {
    const processedValue = key === 'color' ? value : Number(value) || 0;
    setSettings((prev) => ({
      ...prev,
      shadows: {
        ...prev.shadows,
        [key]: processedValue,
      },
    }));
  };

  const updateCornerRadius = (value: number) => {
    // Ensure value is a number with fallback to 0
    const processedValue = typeof value === 'number' ? value : 0;
    setSettings((prev) => ({
      ...prev,
      cornerRadius: processedValue,
    }));
  };

  const updateBackground = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        [key]: value,
      },
    }));
  };

  // Safely access nested properties with fallbacks
  const fontSize = settings.fonts?.size ?? defaultThemeSettings.fonts.size;
  const fontWeight = settings.fonts?.weight ?? defaultThemeSettings.fonts.weight;
  const cornerRadius = settings.cornerRadius ?? defaultThemeSettings.cornerRadius;
  const shadowIntensity = settings.shadows?.intensity ?? defaultThemeSettings.shadows.intensity;
  const paddingValue = settings.spacing?.padding ?? defaultThemeSettings.spacing.padding;
  const marginValue = settings.spacing?.margin ?? defaultThemeSettings.spacing.margin;

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" size="icon" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-semibold">{initialName ? `Edit Theme: ${initialName}` : 'Create New Theme'}</h2>
            <p className="text-muted-foreground">Customize your theme appearance with live preview</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefault}>
            <RotateCw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button variant="outline" onClick={() => setCodeView(!codeView)}>
            <Code className="mr-2 h-4 w-4" /> {codeView ? 'Hide Code' : 'Show Code'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Theme
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left side - Theme Editor */}
        <div className="w-full lg:w-1/2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Theme Settings</CardTitle>
              <CardDescription>Customize your theme's appearance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="theme-name">Theme Name</Label>
                  <Input
                    id="theme-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter theme name"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="public-theme"
                    checked={publicTheme}
                    onCheckedChange={setPublicTheme}
                  />
                  <Label htmlFor="public-theme">Make this theme public in the marketplace</Label>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="colors">Colors</TabsTrigger>
                    <TabsTrigger value="typography">Typography</TabsTrigger>
                    <TabsTrigger value="spacing">Spacing</TabsTrigger>
                    <TabsTrigger value="shadows">Shadows</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                  </TabsList>

                  <TabsContent value="colors" className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(settings.colors).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label htmlFor={`color-${key}`} className="capitalize">{key}</Label>
                            {activeColorPicker === key ? (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => setActiveColorPicker(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-10 h-10 rounded border cursor-pointer" 
                              style={{ backgroundColor: value }}
                              onClick={() => setActiveColorPicker(activeColorPicker === key ? null : key)}
                            />
                            <Input
                              id={`color-${key}`}
                              value={value}
                              onChange={(e) => updateColor(key, e.target.value)}
                            />
                          </div>
                          {activeColorPicker === key && (
                            <div className="relative z-10 mt-2">
                              <ChromePicker 
                                color={value} 
                                onChange={(color) => updateColor(key, color.hex)} 
                                disableAlpha={false}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="typography" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="font-family">Font Family</Label>
                        <Select 
                          value={settings.fonts.family} 
                          onValueChange={(value) => updateFont('family', value)}
                        >
                          <SelectTrigger id="font-family">
                            <SelectValue placeholder="Select a font family" />
                          </SelectTrigger>
                          <SelectContent>
                            {googleFonts.map(font => (
                              <SelectItem key={font.name} value={font.name}>
                                {font.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="font-size">Font Size: {fontSize}px</Label>
                        <Slider
                          id="font-size"
                          min={12}
                          max={24}
                          step={1}
                          value={[fontSize]}
                          onValueChange={(value) => updateFont('size', value[0] || 16)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="font-weight">Font Weight: {fontWeight}</Label>
                        <Select 
                          value={fontWeight.toString()} 
                          onValueChange={(value) => updateFont('weight', value)}
                        >
                          <SelectTrigger id="font-weight">
                            <SelectValue placeholder="Select font weight" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="300">Light (300)</SelectItem>
                            <SelectItem value="400">Regular (400)</SelectItem>
                            <SelectItem value="500">Medium (500)</SelectItem>
                            <SelectItem value="600">Semibold (600)</SelectItem>
                            <SelectItem value="700">Bold (700)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="spacing" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="padding">Padding: {paddingValue}px</Label>
                        <Slider
                          id="padding"
                          min={0}
                          max={32}
                          step={1}
                          value={[paddingValue]}
                          onValueChange={(value) => updateSpacing('padding', value[0] || 0)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="margin">Margin: {marginValue}px</Label>
                        <Slider
                          id="margin"
                          min={0}
                          max={32}
                          step={1}
                          value={[marginValue]}
                          onValueChange={(value) => updateSpacing('margin', value[0] || 0)}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="shadows" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="shadow-intensity">Shadow Intensity: {shadowIntensity}</Label>
                        <Slider
                          id="shadow-intensity"
                          min={0}
                          max={50}
                          step={1}
                          value={[shadowIntensity]}
                          onValueChange={(value) => updateShadows('intensity', value[0] || 0)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="shadow-color">Shadow Color</Label>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-10 h-10 rounded border cursor-pointer" 
                            style={{ backgroundColor: settings.shadows.color }}
                            onClick={() => setActiveColorPicker(activeColorPicker === 'shadow-color' ? null : 'shadow-color')}
                          />
                          <Input
                            id="shadow-color"
                            value={settings.shadows.color}
                            onChange={(e) => updateShadows('color', e.target.value)}
                          />
                        </div>
                        {activeColorPicker === 'shadow-color' && (
                          <div className="relative z-10 mt-2">
                            <ChromePicker 
                              color={settings.shadows.color} 
                              onChange={(color) => updateShadows('color', color.hex)} 
                              disableAlpha={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="other" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="corner-radius">Corner Radius: {cornerRadius}px</Label>
                        <Slider
                          id="corner-radius"
                          min={0}
                          max={20}
                          step={1}
                          value={[cornerRadius]}
                          onValueChange={(value) => updateCornerRadius(value[0] || 0)}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="background-type">Background Type</Label>
                        <Select 
                          value={settings.background.type} 
                          onValueChange={(value) => updateBackground('type', value)}
                        >
                          <SelectTrigger id="background-type">
                            <SelectValue placeholder="Select background type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="color">Color</SelectItem>
                            <SelectItem value="gradient">Gradient</SelectItem>
                            <SelectItem value="image">Image URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="background-value">
                          {settings.background.type === 'color' ? 'Background Color' : 
                          settings.background.type === 'gradient' ? 'Gradient' : 'Image URL'}
                        </Label>
                        {settings.background.type === 'color' ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-10 h-10 rounded border cursor-pointer" 
                              style={{ backgroundColor: settings.background.value }}
                              onClick={() => setActiveColorPicker(activeColorPicker === 'background-value' ? null : 'background-value')}
                            />
                            <Input
                              id="background-value"
                              value={settings.background.value}
                              onChange={(e) => updateBackground('value', e.target.value)}
                            />
                          </div>
                        ) : (
                          <Input
                            id="background-value"
                            value={settings.background.value}
                            onChange={(e) => updateBackground('value', e.target.value)}
                            placeholder={settings.background.type === 'gradient' ? 
                              'linear-gradient(to right, #000, #fff)' : 'https://example.com/image.jpg'}
                          />
                        )}
                        {activeColorPicker === 'background-value' && settings.background.type === 'color' && (
                          <div className="relative z-10 mt-2">
                            <ChromePicker 
                              color={settings.background.value} 
                              onChange={(color) => updateBackground('value', color.hex)} 
                              disableAlpha={false}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right side - Theme Preview */}
        <div className="w-full lg:w-1/2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your theme will look in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              {codeView ? (
                <div className="p-4 bg-muted rounded-md">
                  <pre className="text-xs overflow-auto max-h-[600px]">
                    {JSON.stringify(settings, null, 2)}
                  </pre>
                </div>
              ) : (
                <Tabs defaultValue="preview">
                  <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="mail">Mail</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview">
                    <div className="p-4 border rounded-md mt-2 mb-4">
                      <ThemePreview settings={settings} />
                    </div>
                  </TabsContent>
                  <TabsContent value="mail">
                    <div className="p-4 border rounded-md mt-2">
                      <div className="text-center p-6 text-muted-foreground">
                        Mail preview coming soon
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="tasks">
                    <div className="p-4 border rounded-md mt-2">
                      <div className="text-center p-6 text-muted-foreground">
                        Tasks preview coming soon
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="dashboard">
                    <div className="p-4 border rounded-md mt-2">
                      <div className="text-center p-6 text-muted-foreground">
                        Dashboard preview coming soon
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 