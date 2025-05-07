import { colorFormatter } from "./color-converter";
import { applyStyleToElement } from "./apply-style-to-element";
import { defaultThemeState } from "@/config/theme";
import type { ThemeEditorState } from "@/types/editor";

export const getShadowMap = (themeEditorState: ThemeEditorState) => {
  const mode = themeEditorState.currentMode;
  const styles = {
    ...defaultThemeState.styles[mode],
    ...themeEditorState.styles[mode],
  };

  const shadowColor = styles["shadow-color"];
  const hsl = colorFormatter(shadowColor, "hsl", "3");
  const offsetX = styles["shadow-offset-x"];
  const offsetY = styles["shadow-offset-y"];
  const blur = styles["shadow-blur"];
  const spread = styles["shadow-spread"];
  const opacity = parseFloat(styles["shadow-opacity"]);
  const color = (opacityMultiplier: number) =>
    `hsl(${hsl} / ${(opacity * opacityMultiplier).toFixed(2)})`;

  const secondLayer = (fixedOffsetY: string, fixedBlur: string): string => {
    // Use the same offsetX as the first layer
    const offsetX2 = offsetX;
    // Use the fixed offsetY specific to the shadow size
    const offsetY2 = fixedOffsetY;
    // Use the fixed blur specific to the shadow size
    const blur2 = fixedBlur;
    // Calculate spread relative to the first layer's spread variable
    const spread2 =
      (parseFloat(spread?.replace("px", "") ?? "0") - 1).toString() + "px";
    // Use the same color function (opacity can still be overridden by --shadow-opacity)
    const color2 = color(1.0); // Default opacity for second layer is 0.1 in examples

    return `${offsetX2} ${offsetY2} ${blur2} ${spread2} ${color2}`;
  };

  // Map shadow names to their CSS variable string structures
  const shadowMap: { [key: string]: string } = {
    // Single layer shadows - use base variables directly
    "shadow-2xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`, // Assumes vars set appropriately (e.g., y=1, blur=0, spread=0)
    "shadow-xs": `${offsetX} ${offsetY} ${blur} ${spread} ${color(0.5)}`, // Assumes vars set appropriately (e.g., y=1, blur=2, spread=0)
    "shadow-2xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(2.5)}`, // Assumes vars set appropriately (e.g., y=25, blur=50, spread=-12)

    // Two layer shadows - use base vars for layer 1, mix fixed/calculated for layer 2
    "shadow-sm": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0
    )}, ${secondLayer("1px", "2px")}`,
    shadow: `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0
    )}, ${secondLayer("1px", "2px")}`, // Alias for the 'shadow:' example line

    "shadow-md": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0
    )}, ${secondLayer("2px", "4px")}`,

    "shadow-lg": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0
    )}, ${secondLayer("4px", "6px")}`,

    "shadow-xl": `${offsetX} ${offsetY} ${blur} ${spread} ${color(
      1.0
    )}, ${secondLayer("8px", "10px")}`,
  };

  return shadowMap;
};

// Function to set shadow CSS variables
export function setShadowVariables(themeEditorState: ThemeEditorState) {
  const root = document.documentElement;

  const shadows = getShadowMap(themeEditorState);
  Object.entries(shadows).forEach(([name, value]) => {
    applyStyleToElement(root, name, value);
  });
}
