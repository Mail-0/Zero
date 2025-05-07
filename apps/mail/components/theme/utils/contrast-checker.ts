import * as culori from "culori";

/**
 * Calculates the luminance of a color according to WCAG standard
 * @param colorValue - The color in any supported format
 * @returns The relative luminance of the color (0-1)
 */
function getLuminance(colorValue: string): number {
  try {
    const color = culori.parse(colorValue);
    if (!color) {
      console.warn(`Invalid color: ${colorValue}`);
      return 0;
    }

    // Culori directly provides the luminance according to WCAG standard
    return culori.wcagLuminance(color);
  } catch (error) {
    console.error(`Error calculating luminance: ${colorValue}`, error);
    return 0;
  }
}

/**
 * Calculates the contrast ratio between two colors according to WCAG guidelines
 * @param color1 - First color (in any format)
 * @param color2 - Second color (in any format)
 * @returns The contrast ratio as a string (e.g. "4.50")
 */
export function getContrastRatio(color1: string, color2: string): string {
  try {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);

    // WCAG contrast ratio formula
    const ratio = (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05);
    return ratio.toFixed(2);
  } catch (error) {
    console.error(
      `Error calculating contrast between ${color1} and ${color2}:`,
      error
    );
    return "1.00"; // Fallback value indicating low contrast
  }
}
