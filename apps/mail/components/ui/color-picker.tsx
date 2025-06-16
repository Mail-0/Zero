import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { HexColorPicker } from 'react-colorful';
import { Label } from "./label";

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [color, setColor] = useState(value);

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger>
          <div
            className="w-10 h-10 rounded-md border"
            style={{ backgroundColor: color }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <HexColorPicker
            color={color}
            onChange={(newColor) => {
              setColor(newColor);
              onChange(newColor);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}