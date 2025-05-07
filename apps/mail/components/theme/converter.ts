import Color from 'color';

export const hslToHex = (hsl: string): string => {
  const color = Color(hsl);
  return color.hex();
};

export const hexToHSL = (hex: string) => {
  const color = Color(hex);
  return color.hsl().array().join(' ');
};
