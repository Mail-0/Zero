export const I18N_LOCALE_COOKIE_NAME = "i18n:locale";
export const SIDEBAR_COOKIE_NAME = "sidebar:state";
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
export const SIDEBAR_WIDTH = "12rem";
export const SIDEBAR_WIDTH_MOBILE = "12rem";
export const SIDEBAR_WIDTH_ICON = "3rem";
export const SIDEBAR_KEYBOARD_SHORTCUT = "b";
export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;
export const MAX_URL_LENGTH = 2000;
export const ALLOWED_HTML_TAGS = [
  "p",
  "br",
  "b",
  "i",
  "em",
  "strong",
  "a",
  "img",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "code",
  "div",
  "span",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
];

export const ALLOWED_HTML_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  "*": ["style", "class"],
};

export const ALLOWED_HTML_STYLES = {
  "*": {
    color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
    "background-color": [
      /^#(0x)?[0-9a-f]+$/i,
      /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/,
    ],
    "text-align": [/^left$/, /^right$/, /^center$/],
    "font-size": [/^\d+(?:px|em|%)$/],
  },
};

export const EMAIL_HTML_TEMPLATE = `
<!DOCTYPE html>
  <html>
    <head>
      <base target="_blank" />
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap" rel="stylesheet">
      <style>
        body {
          margin: 0;
          padding: 16px;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.5;
          height: fit-content;
          background-color: rgb(245, 245, 245) !important;
        }
        @media (prefers-color-scheme: dark) {
          body {
            background-color: rgb(10, 10, 10) !important;
          }
        }
        .auto-details summary::marker {
           content: "...";
           cursor: pointer;
        }
        .geist-400 {
          font-family: "Geist", serif;
          font-optical-sizing: auto;
          font-weight: 400;
          font-style: normal;
        }
      </style>
    </head>
    <body>

    </body>
  </html>`;

export const emailProviders = [
  {
    name: "Google",
    icon: "M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z",
    providerId: "google",
  },
] as const;

interface GmailColor {
  name: string;
  textColor: string;
  backgroundColor: string;
}

export const GMAIL_COLORS: GmailColor[] = [
  { name: 'default', textColor: '#000000', backgroundColor: '#E2E2E2' },
  { name: 'red', textColor: '#D50000', backgroundColor: '#F28B82' },
  { name: 'orange', textColor: '#EF6C00', backgroundColor: '#FBBC04' },
  { name: 'yellow', textColor: '#F9A825', backgroundColor: '#FFF475' },
  { name: 'green', textColor: '#188038', backgroundColor: '#CCFF90' },
  { name: 'blue', textColor: '#1967D2', backgroundColor: '#AECBFA' },
  { name: 'purple', textColor: '#9334E6', backgroundColor: '#D7AEFB' },
  { name: 'pink', textColor: '#D93025', backgroundColor: '#FDCFE8' },
  { name: 'brown', textColor: '#3C1E1E', backgroundColor: '#E6C9A8' },
  { name: 'gray', textColor: '#3C4043', backgroundColor: '#E8EAED' },
  { name: 'teal', textColor: '#0B4B3F', backgroundColor: '#A7FFEB' },
  { name: 'indigo', textColor: '#174EA6', backgroundColor: '#C5CAE9' },
  { name: 'lime', textColor: '#33691E', backgroundColor: '#F0F4C3' },
  { name: 'cyan', textColor: '#007B83', backgroundColor: '#B2EBF2' },
  { name: 'violet', textColor: '#5B2C6F', backgroundColor: '#E1BEE7' },
  { name: 'coral', textColor: '#BF360C', backgroundColor: '#FFAB91' },
];
