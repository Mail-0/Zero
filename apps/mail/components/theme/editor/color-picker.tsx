import React, { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import type { ColorPickerProps } from "@/types/theme";

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };

  return debounced;
}

const ColorPicker = ({ color, onChange, label }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localColor, setLocalColor] = useState(color);

  // Update localColor if the prop changes externally
  useEffect(() => {
    setLocalColor(color);
  }, [color]);

  // Create a stable debounced onChange handler
  const debouncedOnChange = useMemo(
    () => debounce((value: string) => onChange(value), 20),
    [onChange]
  );

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocalColor(newColor);
    debouncedOnChange(newColor);
  };

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <Label
          htmlFor={`color-${label.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-xs font-medium"
        >
          {label}
        </Label>
      </div>
      <div className="flex items-center gap-1">
        <div
          className="h-8 w-8 border cursor-pointer overflow-hidden relative flex items-center justify-center rounded"
          style={{ backgroundColor: localColor }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <input
            type="color"
            id={`color-${label.replace(/\s+/g, "-").toLowerCase()}`}
            value={localColor}
            onChange={handleColorChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
        <input
          type="text"
          value={localColor}
          onChange={handleColorChange}
          className="flex-1 h-8 px-2 text-sm rounded bg-input/25 border border-border/20"
        />
      </div>
    </div>
  );
};

export default ColorPicker;
