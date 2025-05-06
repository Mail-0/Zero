import { Button } from '@/components/ui/button';
import { HexColorPicker } from 'react-colorful';
import { useState, useEffect } from 'react';

const defaultTheme = {
  name: '',
  colors: {
    primary: '#fbbf24',
    secondary: '#6366f1',
    background: '#18181b',
    surface: '#232329',
    text: '#fff',
  },
  fonts: {
    body: 'Inter',
    heading: 'Inter',
  },
  spacing: {
    base: 8,
  },
  radius: {
    card: 12,
    button: 8,
  },
  shadows: {
    card: 8,
  },
};

const fontOptions = ['Inter', 'Roboto', 'Geist', 'Montserrat', 'Lato', 'Poppins', 'Open Sans'];

export function ThemeEditor({
  onClose,
  initialTheme,
}: {
  onClose: () => void;
  initialTheme?: any;
}) {
  const [theme, setTheme] = useState(initialTheme || defaultTheme);
  const [colorKey, setColorKey] = useState<
    'primary' | 'secondary' | 'background' | 'surface' | 'text'
  >('primary');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (initialTheme) setTheme(initialTheme);
    else setTheme(defaultTheme);
  }, [initialTheme]);

  const handleColorChange = (color: string) => {
    setTheme((t) => ({ ...t, colors: { ...t.colors, [colorKey]: color } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let res;
      if (initialTheme && initialTheme.id) {
        // Update existing theme
        res = await fetch(`/api/v1/themes/${initialTheme.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...theme,
            name: theme.name || 'Custom Theme',
            backgrounds: theme.backgrounds || {},
          }),
        });
      } else {
        // Create new theme
        res = await fetch('/api/v1/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...theme,
            name: theme.name || 'Custom Theme',
            backgrounds: theme.backgrounds || {},
          }),
        });
      }
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save theme');
        setSaving(false);
        return;
      }
      onClose();
    } catch (e) {
      setError('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialTheme?.id) return;
    if (!window.confirm('Are you sure you want to delete this theme?')) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/themes/${initialTheme.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete theme');
        setDeleting(false);
        return;
      }
      onClose();
    } catch (e) {
      setError('Failed to delete theme');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Theme Name */}
      <div>
        <div className="mb-2 font-medium">Theme Name</div>
        <input
          className="w-full rounded border px-2 py-1"
          value={theme.name}
          onChange={(e) => setTheme((t) => ({ ...t, name: e.target.value }))}
          placeholder="Enter theme name"
        />
      </div>
      {/* Color Swatches */}
      <div>
        <div className="mb-2 font-medium">Colors</div>
        <div className="mb-2 flex gap-3">
          {Object.entries(theme.colors).map(([key, value]) => (
            <button
              key={key}
              className={`h-8 w-8 rounded-full border-2 ${colorKey === key ? 'border-yellow-400' : 'border-transparent'}`}
              style={{ background: value }}
              onClick={() => setColorKey(key as any)}
              aria-label={key}
            />
          ))}
        </div>
        <HexColorPicker color={theme.colors[colorKey]} onChange={handleColorChange} />
        <div className="text-muted-foreground mt-1 text-xs">Editing: {colorKey}</div>
      </div>

      {/* Font Selector */}
      <div>
        <div className="mb-2 font-medium">Font</div>
        <select
          className="rounded border px-2 py-1"
          value={theme.fonts.body}
          onChange={(e) => setTheme((t) => ({ ...t, fonts: { ...t.fonts, body: e.target.value } }))}
        >
          {fontOptions.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>
      </div>

      {/* Spacing, Radius, Shadow Sliders */}
      <div className="flex gap-6">
        <div>
          <div className="mb-2 font-medium">Spacing</div>
          <input
            type="range"
            min={4}
            max={32}
            value={theme.spacing.base}
            onChange={(e) =>
              setTheme((t) => ({ ...t, spacing: { ...t.spacing, base: Number(e.target.value) } }))
            }
          />
          <div className="text-xs">{theme.spacing.base}px</div>
        </div>
        <div>
          <div className="mb-2 font-medium">Radius</div>
          <input
            type="range"
            min={0}
            max={32}
            value={theme.radius.card}
            onChange={(e) =>
              setTheme((t) => ({ ...t, radius: { ...t.radius, card: Number(e.target.value) } }))
            }
          />
          <div className="text-xs">{theme.radius.card}px</div>
        </div>
        <div>
          <div className="mb-2 font-medium">Shadow</div>
          <input
            type="range"
            min={0}
            max={32}
            value={theme.shadows.card}
            onChange={(e) =>
              setTheme((t) => ({ ...t, shadows: { ...t.shadows, card: Number(e.target.value) } }))
            }
          />
          <div className="text-xs">{theme.shadows.card}px</div>
        </div>
      </div>

      {/* Live Preview */}
      <div
        className="rounded-lg p-6"
        style={{
          background: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          borderRadius: theme.radius.card,
          boxShadow: `0 2px ${theme.shadows.card}px rgba(0,0,0,0.2)`,
        }}
      >
        <div className="mb-2 text-lg font-bold">Live Preview</div>
        <div className="flex gap-4">
          <div className="flex-1">
            <div className="mb-2">Primary Color</div>
            <div className="h-4 w-12 rounded" style={{ background: theme.colors.primary }} />
          </div>
          <div className="flex-1">
            <div className="mb-2">Secondary Color</div>
            <div className="h-4 w-12 rounded" style={{ background: theme.colors.secondary }} />
          </div>
        </div>
        <div className="mt-4">Font: {theme.fonts.body}</div>
        <div className="mt-2 text-xs">
          Spacing: {theme.spacing.base}px, Radius: {theme.radius.card}px, Shadow:{' '}
          {theme.shadows.card}px
        </div>
      </div>

      {/* Actions & Error */}
      {error && <div className="text-sm text-red-500">{error}</div>}
      <div className="flex justify-end gap-2">
        {initialTheme && initialTheme.id && (
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        )}
        <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
          Cancel
        </Button>
        <Button variant="default" onClick={handleSave} disabled={saving || !theme.name || deleting}>
          {saving ? 'Saving...' : initialTheme && initialTheme.id ? 'Save Changes' : 'Save Theme'}
        </Button>
      </div>
    </div>
  );
}
