import { Button } from "../ui/button";
import { ColorPicker } from "../ui/color-picker";
import { FontSelector } from "../ui/font-selector";
import { RangeInput } from "../ui/range-input";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import type { Theme } from "../../types/theme";

interface ThemeEditorProps {
  theme: Theme;
  onChange: (updates: Partial<Theme>) => void;
  onSave: () => void; // Updated to take no arguments
}

export function ThemeEditor({ theme, onChange, onSave }: ThemeEditorProps) {
  const handleRadiusChange = (value: number, key: keyof Theme["radius"]) => {
    onChange({
      radius: {
        ...theme.radius,
        [key]: `${value}px`,
      },
    });
  };

  const handleSpacingChange = (value: number, key: keyof Theme["spacing"]) => {
    onChange({
      spacing: {
        ...theme.spacing,
        [key]: `${value}px`,
      },
    });
  };

  // Helper to parse pixel values (e.g., "1rem" or "16px" to a number)
  const parsePixelValue = (value: string): number => {
    if (!value) return 0;
    const numericValue = parseFloat(value);
    // Convert rem to px (assuming 1rem = 16px for simplicity)
    if (value.includes("rem")) {
      return numericValue * 16;
    }
    return numericValue;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <ColorPicker
          label="Primary Color"
          value={theme.colors.primary}
          onChange={(color) =>
            onChange({ colors: { ...theme.colors, primary: color } })
          }
        />
      </div>

      <div className="space-y-4">
        <FontSelector
          label="Body Font"
          value={theme.fonts?.body || "Inter"}
          onChange={(font) =>
            onChange({ fonts: { ...theme.fonts, body: font } })
          }
        />
        <FontSelector
          label="Heading Font"
          value={theme.fonts?.heading || "Inter"}
          onChange={(font) =>
            onChange({ fonts: { ...theme.fonts, heading: font } })
          }
        />
      </div>

      <div className="space-y-4">
        <RangeInput
          label="Base Spacing"
          value={parsePixelValue(theme.spacing?.default || "0")}
          min={0}
          max={20}
          step={1}
          onChange={(value) => handleSpacingChange(value, "default")}
        />
      </div>

      <div className="space-y-4">
        <RangeInput
          label="Corner Radius"
          value={parsePixelValue(theme.radius?.default || "0")}
          min={0}
          max={20}
          step={1}
          onChange={(value) => handleRadiusChange(value, "default")}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="public-theme"
          checked={theme.isPublic || false}
          onCheckedChange={(checked) =>
            onChange({ isPublic: checked === true })
          }
        />
        <Label htmlFor="public-theme">Make this theme public in the marketplace</Label>
      </div>

      <Button onClick={onSave}>Save Theme</Button>
    </div>
  );
}