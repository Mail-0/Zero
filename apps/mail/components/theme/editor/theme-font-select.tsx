import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ThemeFontSelectProps {
  fonts: Record<string, string>;
  defaultValue: string;
  currentFont: string | null;
  onFontChange: (font: string) => void;
}

const ThemeFontSelect: React.FC<ThemeFontSelectProps> = ({
  fonts,
  defaultValue,
  currentFont,
  onFontChange,
}) => {
  const fontNames = useMemo(() => ["System", ...Object.keys(fonts)], [fonts]);
  const value = currentFont ? fonts[currentFont] ?? defaultValue : defaultValue;

  return (
    <Select value={value || ""} onValueChange={onFontChange}>
      <div className="flex gap-1 items-center w-full">
        <SelectTrigger className="w-full bg-secondary text-secondary-foreground">
          <SelectValue placeholder="Select theme font" />
        </SelectTrigger>
      </div>
      <SelectContent className="max-h-[400px]">
        <SelectGroup>
          {fontNames.map((fontName) => (
            <SelectItem key={fontName} value={fonts[fontName] ?? defaultValue}>
              <span
                style={{
                  fontFamily: fonts[fontName] ?? defaultValue,
                }}
              >
                {fontName}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default ThemeFontSelect;
