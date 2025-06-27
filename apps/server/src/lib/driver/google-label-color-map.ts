type ColorMapping = {
  backgroundColor: string;
  textColor: string;
};

export const GOOGLE_LABEL_COLOR_MAP: Record<string, ColorMapping> = {
  '#ffffff|#000000': { textColor: '#FFFFFF', backgroundColor: '#202020' },
  '#16a766|#ffffff': { textColor: '#D1F0D9', backgroundColor: '#12341D' },
  '#ffad47|#ffffff': { textColor: '#FDECCE', backgroundColor: '#413111' },
  '#4a86e8|#ffffff': { textColor: '#D8E6FD', backgroundColor: '#1C2A41' },
  '#a479e2|#ffffff': { textColor: '#E8DEFD', backgroundColor: '#2C2341' },
  '#f691b3|#ffffff': { textColor: '#FDD9DF', backgroundColor: '#411D23' },
};

export function mapGoogleLabelColor(
  googleColor: ColorMapping | undefined,
): ColorMapping | undefined {
  if (!googleColor || !googleColor.backgroundColor || !googleColor.textColor) {
    return googleColor;
  }

  const key = `${googleColor.backgroundColor}|${googleColor.textColor}`;
  const mappedColor = GOOGLE_LABEL_COLOR_MAP[key];

  return mappedColor || googleColor;
}

export function mapToGoogleLabelColor(
  customColor: ColorMapping | undefined,
): ColorMapping | undefined {
  if (!customColor || !customColor.backgroundColor || !customColor.textColor) {
    return customColor;
  }

  for (const [googleKey, mappedValue] of Object.entries(GOOGLE_LABEL_COLOR_MAP)) {
    if (
      mappedValue.backgroundColor === customColor.backgroundColor &&
      mappedValue.textColor === customColor.textColor
    ) {
      const parts = googleKey.split('|');
      const backgroundColor = parts[0] || '';
      const textColor = parts[1] || '';
      return { backgroundColor, textColor };
    }
  }

  return customColor;
}
