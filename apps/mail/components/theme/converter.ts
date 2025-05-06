import * as culori from 'culori';

const formatNumber = (num?: number) => {
  if (!num) return '0';
  return Math.round(num * 100) / 100;
};

export const convertToHSL = (colorValue: string) => {
  try {
    const color = culori.parse(colorValue);
    if (!color) throw new Error('Invalid color input');
    const hsl = culori.converter('hsl')(color);
    return `hsl(${formatNumber(hsl.h)} ${formatNumber(hsl.s * 100)}% ${formatNumber(hsl.l * 100)}%)`;
  } catch (error) {
    console.error(`Failed to convert color: ${colorValue}`, error);
    return colorValue;
  }
};
