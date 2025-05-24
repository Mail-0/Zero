type ColorMapping = {
  backgroundColor: string;
  textColor: string;
};

export const GOOGLE_LABEL_COLOR_MAP: Record<string, ColorMapping> = {
  // TODO: Add your custom color mappings here
  // Example format:
  // '#ffffff|#000000': { backgroundColor: '#yourCustomBg', textColor: '#yourCustomText' },

  // Grayscale
  '#000000|#ffffff': { backgroundColor: '#000000', textColor: '#ffffff' },
  '#434343|#ffffff': { backgroundColor: '#434343', textColor: '#ffffff' },
  '#666666|#ffffff': { backgroundColor: '#666666', textColor: '#ffffff' },
  '#999999|#ffffff': { backgroundColor: '#999999', textColor: '#ffffff' },
  '#cccccc|#000000': { backgroundColor: '#cccccc', textColor: '#000000' },
  '#ffffff|#000000': { backgroundColor: '#ffffff', textColor: '#000000' },

  // Warm colors
  '#fb4c2f|#ffffff': { backgroundColor: '#fb4c2f', textColor: '#ffffff' },
  '#ffad47|#ffffff': { backgroundColor: '#ffad47', textColor: '#ffffff' },
  '#fad165|#000000': { backgroundColor: '#fad165', textColor: '#000000' },
  '#ff7537|#ffffff': { backgroundColor: '#ff7537', textColor: '#ffffff' },
  '#cc3a21|#ffffff': { backgroundColor: '#cc3a21', textColor: '#ffffff' },
  '#8a1c0a|#ffffff': { backgroundColor: '#8a1c0a', textColor: '#ffffff' },

  // Cool colors
  '#16a766|#ffffff': { backgroundColor: '#16a766', textColor: '#ffffff' },
  '#43d692|#ffffff': { backgroundColor: '#43d692', textColor: '#ffffff' },
  '#4a86e8|#ffffff': { backgroundColor: '#4a86e8', textColor: '#ffffff' },
  '#285bac|#ffffff': { backgroundColor: '#285bac', textColor: '#ffffff' },
  '#3c78d8|#ffffff': { backgroundColor: '#3c78d8', textColor: '#ffffff' },
  '#0d3472|#ffffff': { backgroundColor: '#0d3472', textColor: '#ffffff' },

  // Purple tones
  '#a479e2|#ffffff': { backgroundColor: '#a479e2', textColor: '#ffffff' },
  '#b99aff|#ffffff': { backgroundColor: '#b99aff', textColor: '#ffffff' },
  '#653e9b|#ffffff': { backgroundColor: '#653e9b', textColor: '#ffffff' },
  '#3d188e|#ffffff': { backgroundColor: '#3d188e', textColor: '#ffffff' },
  '#f691b3|#ffffff': { backgroundColor: '#f691b3', textColor: '#ffffff' },
  '#994a64|#ffffff': { backgroundColor: '#994a64', textColor: '#ffffff' },

  // Pastels
  '#f6c5be|#000000': { backgroundColor: '#f6c5be', textColor: '#000000' },
  '#ffe6c7|#000000': { backgroundColor: '#ffe6c7', textColor: '#000000' },
  '#c6f3de|#000000': { backgroundColor: '#c6f3de', textColor: '#000000' },
  '#c9daf8|#000000': { backgroundColor: '#c9daf8', textColor: '#000000' },
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
