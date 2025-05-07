import React from "react";
import { SliderWithInput } from "./slider-with-input";
import ColorPicker from "./color-picker";
import ControlSection from "./control-section";

interface ShadowControlProps {
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  onChange: (key: string, value: string | number) => void;
}

const ShadowControl: React.FC<ShadowControlProps> = ({
  shadowColor,
  shadowOpacity,
  shadowBlur,
  shadowSpread,
  shadowOffsetX,
  shadowOffsetY,
  onChange,
}) => {
  return (
    <ControlSection title="Shadow" expanded>
      <div className="space-y-4">
        <div>
          <ColorPicker
            color={shadowColor}
            onChange={(color) => onChange("shadow-color", color)}
            label="Shadow Color"
          />
        </div>

        <div>
          <SliderWithInput
            value={shadowOpacity}
            onChange={(value) => onChange("shadow-opacity", value)}
            min={0}
            max={1}
            step={0.01}
            unit=""
            label="Shadow Opacity"
          />
        </div>

        <div>
          <SliderWithInput
            value={shadowBlur}
            onChange={(value) => onChange("shadow-blur", value)}
            min={0}
            max={50}
            step={0.5}
            unit="px"
            label="Blur Radius"
          />
        </div>

        <div>
          <SliderWithInput
            value={shadowSpread}
            onChange={(value) => onChange("shadow-spread", value)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Spread"
          />
        </div>

        <div>
          <SliderWithInput
            value={shadowOffsetX}
            onChange={(value) => onChange("shadow-offset-x", value)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Offset X"
          />
        </div>

        <div>
          <SliderWithInput
            value={shadowOffsetY}
            onChange={(value) => onChange("shadow-offset-y", value)}
            min={-50}
            max={50}
            step={0.5}
            unit="px"
            label="Offset Y"
          />
        </div>
      </div>
    </ControlSection>
  );
};

export default ShadowControl;
