
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
];

export function ThemeCustomizerModal({ open, theme, onClose, onSave }: {
  open: boolean;
  theme: any;
  onClose: () => void;
  onSave: (customizedTheme: any) => void;
}) {
  const [customTheme, setCustomTheme] = useState({
    name: theme.name,
    colors: theme.colors || {
      primary: '#6366f1',
      secondary: '#f59e42',
      background: '#fff',
      text: '#222',
    },
    font: theme.font || FONT_OPTIONS[0].value,
    padding: theme.padding || 24,
    margin: theme.margin || 24,
    radius: theme.radius || 12,
    shadow: theme.shadow || 'light',
    backgroundType: theme.backgroundType || 'solid',
    backgroundImage: theme.backgroundImage || '',
    backgroundGradient: theme.backgroundGradient || '',
  });

  const handleColorChange = (key: string, value: string) => {
    setCustomTheme(prev => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  };

  const previewStyle: React.CSSProperties = {
    background: customTheme.backgroundType === 'solid' ? customTheme.colors.background :
      customTheme.backgroundType === 'gradient' ? customTheme.backgroundGradient :
      customTheme.backgroundType === 'image' && customTheme.backgroundImage ? `url(${customTheme.backgroundImage})` : customTheme.colors.background,
    color: customTheme.colors.text,
    fontFamily: customTheme.font,
    padding: customTheme.padding,
    margin: 0,
    borderRadius: customTheme.radius,
    boxShadow: customTheme.shadow === 'none' ? 'none' : customTheme.shadow === 'deep' ? '0 8px 32px #0003' : '0 2px 12px #0001',
    minHeight: 260,
    minWidth: 340,
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    border: '1px solid #e5e7eb',
    backgroundSize: customTheme.backgroundType === 'image' ? 'cover' : undefined,
    backgroundPosition: customTheme.backgroundType === 'image' ? 'center' : undefined,
    transition: 'all 0.2s',
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent showOverlay className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-2">
          <DialogTitle className="text-2xl font-bold">Customize Theme: <span className="text-primary">{theme.name}</span></DialogTitle>
        </DialogHeader>
        <div className="flex flex-col md:flex-row gap-0 md:gap-8 px-8 pb-8 h-96">
          {/* Controls */}
          <div className="flex flex-col gap-8 w-full md:w-[340px] overflow-auto border-r border-muted/30 pr-0 md:pr-8">
            {/* Colors */}
            <div>
              <div className="font-semibold text-lg mb-3">Colors</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Primary</label>
                  <input type="color" className="w-8 h-8 rounded border" value={customTheme.colors.primary} onChange={e => handleColorChange('primary', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Secondary</label>
                  <input type="color" className="w-8 h-8 rounded border" value={customTheme.colors.secondary} onChange={e => handleColorChange('secondary', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Background</label>
                  <input type="color" className="w-8 h-8 rounded border" value={customTheme.colors.background} onChange={e => handleColorChange('background', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Text</label>
                  <input type="color" className="w-8 h-8 rounded border" value={customTheme.colors.text} onChange={e => handleColorChange('text', e.target.value)} />
                </div>
              </div>
            </div>
            {/* Fonts */}
            <div>
              <div className="font-semibold text-lg mb-3">Font</div>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={customTheme.font}
                onChange={e => setCustomTheme(prev => ({ ...prev, font: e.target.value }))}
              >
                {FONT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>{opt.label}</option>
                ))}
              </select>
              <div className="text-xs text-muted-foreground mt-1" style={{ fontFamily: customTheme.font }}>
                Preview: The quick brown fox jumps over the lazy dog.
              </div>
            </div>
            {/* Spacing */}
            <div>
              <div className="font-semibold text-lg mb-3">Spacing</div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium">Padding <span className="ml-1 text-muted-foreground">{customTheme.padding}px</span></label>
                <input type="range" min={0} max={64} value={customTheme.padding} onChange={e => setCustomTheme(prev => ({ ...prev, padding: Number(e.target.value) }))} />
                <label className="text-xs font-medium">Margin <span className="ml-1 text-muted-foreground">{customTheme.margin}px</span></label>
                <input type="range" min={0} max={64} value={customTheme.margin} onChange={e => setCustomTheme(prev => ({ ...prev, margin: Number(e.target.value) }))} />
              </div>
            </div>
            {/* Corners & Shadow */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="font-semibold text-lg mb-3">Corners</div>
                <label className="text-xs font-medium">Radius <span className="ml-1 text-muted-foreground">{customTheme.radius}px</span></label>
                <input type="range" min={0} max={32} value={customTheme.radius} onChange={e => setCustomTheme(prev => ({ ...prev, radius: Number(e.target.value) }))} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-lg mb-3">Shadow</div>
                <select className="w-full border rounded px-2 py-1 text-sm" value={customTheme.shadow} onChange={e => setCustomTheme(prev => ({ ...prev, shadow: e.target.value }))}>
                  <option value="none">No Shadow</option>
                  <option value="light">Light</option>
                  <option value="deep">Deep</option>
                </select>
              </div>
            </div>
            {/* Backgrounds */}
            <div>
              <div className="font-semibold text-lg mb-3">Background Style</div>
              <select className="w-full border rounded px-2 py-1 text-sm mb-2" value={customTheme.backgroundType} onChange={e => setCustomTheme(prev => ({ ...prev, backgroundType: e.target.value }))}>
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="image">Image</option>
              </select>
              {customTheme.backgroundType === 'gradient' && (
                <input type="text" className="w-full border rounded px-2 py-1 mt-1" placeholder="e.g. linear-gradient(90deg, #6366f1, #f59e42)" value={customTheme.backgroundGradient} onChange={e => setCustomTheme(prev => ({ ...prev, backgroundGradient: e.target.value }))} />
              )}
              {customTheme.backgroundType === 'image' && (
                <input type="text" className="w-full border rounded px-2 py-1 mt-1" placeholder="Image URL" value={customTheme.backgroundImage} onChange={e => setCustomTheme(prev => ({ ...prev, backgroundImage: e.target.value }))} />
              )}
            </div>
          </div>
          {/* Live Preview */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[340px]">
            <div className="font-semibold text-lg mb-4">Live Preview</div>
            <div style={previewStyle} className="w-full max-w-[400px] shadow-lg border bg-white/80">
              <div className="w-full flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: customTheme.colors.primary, color: customTheme.colors.text, fontWeight: 700, fontSize: 20 }}>
                  {customTheme.name}
                </div>
                <div>
                  <div className="font-bold text-lg" style={{ color: customTheme.colors.text }}>{customTheme.name}</div>
                  <div className="text-xs text-muted-foreground">Preview Card</div>
                </div>
              </div>
              <div className="text-base mb-2" style={{ color: customTheme.colors.text, fontFamily: customTheme.font }}>
                The quick brown fox jumps over the lazy dog.
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" style={{ background: customTheme.colors.primary, color: customTheme.colors.text, borderRadius: customTheme.radius }}>Primary</Button>
                <Button size="sm" variant="outline" style={{ borderColor: customTheme.colors.secondary, color: customTheme.colors.secondary, borderRadius: customTheme.radius }}>Secondary</Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6 px-8 pb-8 justify-end">
          <Button onClick={() => onSave(customTheme)} className="px-6">Save</Button>
          <Button variant="outline" onClick={onClose} className="px-6">Cancel</Button>
        </div>
        <DialogClose asChild>
          <Button variant="outline" className="hidden">Close</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
} 