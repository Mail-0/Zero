export const LABEL_COLORS = [
  // Row 1 - Grayscale
  { backgroundColor: '#000000', textColor: '#ffffff' },
  { backgroundColor: '#434343', textColor: '#ffffff' },
  { backgroundColor: '#666666', textColor: '#ffffff' },
  { backgroundColor: '#999999', textColor: '#ffffff' },
  { backgroundColor: '#cccccc', textColor: '#000000' },
  { backgroundColor: '#ffffff', textColor: '#000000' },
  // Row 2 - Warm colors
  { backgroundColor: '#fb4c2f', textColor: '#ffffff' },
  { backgroundColor: '#ffad47', textColor: '#ffffff' },
  { backgroundColor: '#fad165', textColor: '#000000' },
  { backgroundColor: '#ff7537', textColor: '#ffffff' },
  { backgroundColor: '#cc3a21', textColor: '#ffffff' },
  { backgroundColor: '#8a1c0a', textColor: '#ffffff' },
  // Row 3 - Cool colors
  { backgroundColor: '#16a766', textColor: '#ffffff' },
  { backgroundColor: '#43d692', textColor: '#ffffff' },
  { backgroundColor: '#4a86e8', textColor: '#ffffff' },
  { backgroundColor: '#285bac', textColor: '#ffffff' },
  { backgroundColor: '#3c78d8', textColor: '#ffffff' },
  { backgroundColor: '#0d3472', textColor: '#ffffff' },
  // Row 4 - Purple tones
  { backgroundColor: '#a479e2', textColor: '#ffffff' },
  { backgroundColor: '#b99aff', textColor: '#ffffff' },
  { backgroundColor: '#653e9b', textColor: '#ffffff' },
  { backgroundColor: '#3d188e', textColor: '#ffffff' },
  { backgroundColor: '#f691b3', textColor: '#ffffff' },
  { backgroundColor: '#994a64', textColor: '#ffffff' },
  // Row 5 - Pastels
  { backgroundColor: '#f6c5be', textColor: '#000000' },
  { backgroundColor: '#ffe6c7', textColor: '#000000' },
  { backgroundColor: '#c6f3de', textColor: '#000000' },
  { backgroundColor: '#c9daf8', textColor: '#000000' },
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

export function isValidLabelColor(color: { backgroundColor: string; textColor: string }): boolean {
  return LABEL_COLORS.some(
    (labelColor) =>
      labelColor.backgroundColor === color.backgroundColor &&
      labelColor.textColor === color.textColor,
  );
}

export const LABEL_BACKGROUND_COLORS = LABEL_COLORS.map((color) => color.backgroundColor);
