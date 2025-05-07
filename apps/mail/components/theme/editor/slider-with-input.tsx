import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export const SliderWithInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit = "px",
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
}) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <Label
          htmlFor={`slider-${label.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-xs font-medium"
        >
          {label}
        </Label>
        <div className="flex items-center gap-1">
          <Input
            id={`input-${label.replace(/\s+/g, "-").toLowerCase()}`}
            type="number"
            value={localValue}
            onChange={(e) => {
              const newValue = Number(e.target.value);
              setLocalValue(newValue);
              onChange(newValue);
            }}
            min={min}
            max={max}
            step={step}
            className="h-6 w-18 text-xs px-2"
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <Slider
        id={`slider-${label.replace(/\s+/g, "-").toLowerCase()}`}
        value={[localValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => {
          if (values[0] !== undefined) {
            setLocalValue(values[0]);
            onChange(values[0]);
          }
        }}
        className="py-1"
      />
    </div>
  );
};
