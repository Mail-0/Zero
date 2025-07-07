import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

interface ProcessEmailOptions {
  html: string;
  shouldLoadImages: boolean;
  theme: 'light' | 'dark';
}

export function processEmailHtml({ html, shouldLoadImages, theme }: ProcessEmailOptions): {
  processedHtml: string;
  hasBlockedImages: boolean;
} {
  let hasBlockedImages = false;

  const sanitizeConfig: sanitizeHtml.IOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style', 'title']),

    allowedAttributes: {
      '*': [
        'class',
        'style',
        'align',
        'valign',
        'width',
        'height',
        'cellpadding',
        'cellspacing',
        'border',
        'bgcolor',
        'colspan',
        'rowspan',
      ],
      a: ['href', 'name', 'target', 'rel', 'class', 'style'],
      img: ['src', 'alt', 'width', 'height', 'class', 'style'],
    },

    allowedStyles: {
      '*': {
        color: [
          /^#(?:[0-9a-fA-F]{3}){1,2}$/,
          /^rgb\(\d{1,3},\s?\d{1,3},\s?\d{1,3}\)$/,
          /^rgba\(\d{1,3},\s?\d{1,3},\s?\d{1,3},\s?(0|1|0?\.\d+)\)$/,
        ],
        'background-color': [
          /^#(?:[0-9a-fA-F]{3}){1,2}$/,
          /^rgb\(\d{1,3},\s?\d{1,3},\s?\d{1,3}\)$/,
          /^rgba\(\d{1,3},\s?\d{1,3},\s?\d{1,3},\s?(0|1|0?\.\d+)\)$/,
        ],
        'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
        'font-size': [/^\d+(?:px|em|rem|%)$/],
        'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/],
        'line-height': [/^\d+(?:px|em|rem|%)$/],
        'text-decoration': [/^none$/, /^underline$/, /^line-through$/],
        margin: [/^\d+(?:px|%)?(\s+\d+(?:px|%)?){0,3}$/],
        padding: [/^\d+(?:px|%)?(\s+\d+(?:px|%)?){0,3}$/],
        border: [/^\d+px\s+(solid|dashed|dotted|double)\s+#(?:[0-9a-fA-F]{3}){1,2}$/],
        'border-radius': [/^\d+(?:px|%)$/],
        width: [/^\d+(?:px|%)$/],
        height: [/^\d+(?:px|%)$/],
        'max-width': [/^\d+(?:px|%)$/],
        'min-width': [/^\d+(?:px|%)$/],
        display: [/^inline$/, /^block$/, /^inline-block$/, /^none$/],
      },
    },
    allowedSchemes: shouldLoadImages
      ? ['http', 'https', 'mailto', 'tel', 'data', 'cid', 'blob']
      : ['http', 'https', 'mailto', 'tel', 'cid'],
    allowedSchemesByTag: {
      img: shouldLoadImages ? ['http', 'https', 'data', 'cid', 'blob'] : ['cid'],
    },

    transformTags: {
      img: (tagName, attribs) => {
        if (!shouldLoadImages && attribs.src && !attribs.src.startsWith('cid:')) {
          hasBlockedImages = true;
          return { tagName: 'span', attribs: { style: 'display:none;' } };
        }
        return { tagName, attribs };
      },
      a: (tagName, attribs) => {
        return {
          tagName,
          attribs: {
            ...attribs,
            target: attribs.target || '_blank',
            rel: 'noopener noreferrer',
          },
        };
      },
    },
  };

  const sanitized = sanitizeHtml(html, sanitizeConfig);

  const $ = cheerio.load(sanitized);

  $('title').remove();

  $('img[width="1"][height="1"]').remove();
  $('img[width="0"][height="0"]').remove();

  $('.preheader, .preheaderText, [class*="preheader"]').each((_, el) => {
    const $el = $(el);
    const style = $el.attr('style') || '';
    if (
      style.includes('display:none') ||
      style.includes('display: none') ||
      style.includes('font-size:0') ||
      style.includes('font-size: 0') ||
      style.includes('line-height:0') ||
      style.includes('line-height: 0') ||
      style.includes('max-height:0') ||
      style.includes('max-height: 0') ||
      style.includes('mso-hide:all') ||
      style.includes('opacity:0') ||
      style.includes('opacity: 0')
    ) {
      $el.remove();
    }
  });

  const minimalStyles = `
    <style type="text/css">
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
        font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        line-height: 1.5;
        background-color: ${theme === 'dark' ? '#1A1A1A' : '#ffffff'};
        color: ${theme === 'dark' ? '#ffffff' : '#000000'};
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 0;
      }

      a {
        cursor: pointer;
        color: ${theme === 'dark' ? '#60a5fa' : '#2563eb'};
        text-decoration: underline;
      }

      a:hover {
        color: ${theme === 'dark' ? '#93bbfc' : '#1d4ed8'};
      }

      img {
        max-width: 100%;
        height: auto;
        display: block;
      }

      table {
        border-collapse: collapse;
      }

      ::selection {
        background: #b3d4fc;
        text-shadow: none;
      }
    </style>
  `;

  const fullHtml = $.html();

  const finalHtml = `${minimalStyles}${fullHtml}`;

  return {
    processedHtml: finalHtml,
    hasBlockedImages,
  };
}
