import { FONTS, FONT_FACES, THEME_COLORS } from './constants';

export const generateFontFaces = () => {
  return FONT_FACES.map(
    (font) => `
    @font-face {
      font-family: '${FONTS.PRIMARY}';
      src: url('/fonts/geist/Geist-${font.name}.ttf') format('truetype');
      font-weight: ${font.weight};
      font-style: normal;
    }
  `
  ).join('\n');
};

export const generateColorSchemeStyles = () => `
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
    }
    body {
      background: ${THEME_COLORS.DARK.BACKGROUND} !important;
      color: ${THEME_COLORS.DARK.TEXT} !important;
    }
    * {
      background: ${THEME_COLORS.DARK.BACKGROUND} !important;
      color: ${THEME_COLORS.DARK.TEXT} !important;
    }
    a {
      color: ${THEME_COLORS.DARK.LINK} !important;
    }
    a:hover {
      color: ${THEME_COLORS.DARK.LINK_HOVER} !important;
    }
  }
  @media (prefers-color-scheme: light) {
    :root {
      color-scheme: light;
    }
    body {
      background: ${THEME_COLORS.LIGHT.BACKGROUND} !important;
      color: ${THEME_COLORS.LIGHT.TEXT} !important;
    }
    * {
      background: ${THEME_COLORS.LIGHT.BACKGROUND} !important;
      color: ${THEME_COLORS.LIGHT.TEXT} !important;
    }
    a {
      color: ${THEME_COLORS.LIGHT.LINK} !important;
    }
    a:hover {
      color: ${THEME_COLORS.LIGHT.LINK_HOVER} !important;
    }
  }
`;

export const generateEmailClientStyles = () => `
  table {
    border-collapse: separate !important;
    border-spacing: 0 !important;
    table-layout: fixed !important;
    mso-table-lspace: 0pt !important;
    mso-table-rspace: 0pt !important;
  }
  
  img {
    -ms-interpolation-mode: bicubic;
    max-width: 100%;
    height: auto;
  }
`;

export const generateExternalClassStyles = () => `
  .ExternalClass {
    width: 100%;
  }
  
  .ExternalClass,
  .ExternalClass p,
  .ExternalClass span,
  .ExternalClass font,
  .ExternalClass td,
  .ExternalClass div {
    line-height: 100%;
  }
`;

interface EmailStyleOptions {
  includeFonts?: boolean;
  includeColorSchemes?: boolean;
  includeEmailClient?: boolean;
  includeExternalClass?: boolean;
}

export const generateEmailStyles = ({
  includeFonts = true,
  includeColorSchemes = true,
  includeEmailClient = true,
  includeExternalClass = true,
}: EmailStyleOptions = {}) => {
  const styles: string[] = [];

  if (includeFonts) {
    styles.push(generateFontFaces());
  }
  if (includeColorSchemes) {
    styles.push(generateColorSchemeStyles());
  }
  if (includeEmailClient) {
    styles.push(generateEmailClientStyles());
  }
  if (includeExternalClass) {
    styles.push(generateExternalClassStyles());
  }

  return styles.join('\n');
}; 