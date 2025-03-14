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
