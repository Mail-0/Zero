export const LABEL_COLORS = [
  { textColor: '#FFFFFF', backgroundColor: '#202020' },
  { textColor: '#D1F0D9', backgroundColor: '#12341D' },
  { textColor: '#FDECCE', backgroundColor: '#413111' },
  { textColor: '#FDD9DF', backgroundColor: '#411D23' },
  { textColor: '#D8E6FD', backgroundColor: '#1C2A41' },
  { textColor: '#E8DEFD', backgroundColor: '#2C2341' },
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
