import { Label } from "./label";
import { Slider } from "./slider";

interface RangeInputProps {
  label: string;
  value: number;  // Changed from string to number
  onChange: (value: number) => void;  // Changed from string to number
  min?: number;
  max?: number;
  step?: number;
}

export function RangeInput({ 
  label, 
  value, 
  onChange,
  min = 0,
  max = 100,
  step = 1
}: RangeInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Slider
        value={[value]}
        onValueChange={(values: number[]) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}