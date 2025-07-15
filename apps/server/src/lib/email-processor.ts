import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';

interface ProcessEmailOptions {
  html: string;
  shouldLoadImages: boolean;
  theme: 'light' | 'dark';
}

// Server-side: Heavy lifting, preference-independent processing
export function preprocessEmailHtml(html: string): string {
  const sanitizeConfig: sanitizeHtml.IOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'title', 'details', 'summary']),

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

    // Allow only safe schemes - no blob for security
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data', 'cid'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data', 'cid'],
    },

    transformTags: {
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

  // Collapse quoted text (structure only, no theme colors)
  const collapseQuoted = (selector: string) => {
    $(selector).each((_, el) => {
      const $el = $(el);
      if ($el.parents('details.quoted-toggle').length) return;

      const innerHtml = $el.html();
      if (typeof innerHtml !== 'string') return;
      const detailsHtml = `<details class="quoted-toggle" style="margin-top:1em;">
          <summary style="cursor:pointer;" data-theme-color="muted">
            Show quoted text
          </summary>
          ${innerHtml}
        </details>`;

      $el.replaceWith(detailsHtml);
    });
  };

  collapseQuoted('blockquote');
  collapseQuoted('.gmail_quote');

  // Remove unwanted elements
  $('title').remove();
  $('img[width="1"][height="1"]').remove();
  $('img[width="0"][height="0"]').remove();

  // Remove preheader content
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

  return $.html();
}

// Client-side: Light styling + image preferences
export function applyEmailPreferences(
  preprocessedHtml: string, 
  theme: 'light' | 'dark', 
  shouldLoadImages: boolean
): { processedHtml: string; hasBlockedImages: boolean } {
  let hasBlockedImages = false;
  const isDarkTheme = theme === 'dark';

  const $ = cheerio.load(preprocessedHtml);

  // Handle image blocking if needed
  if (!shouldLoadImages) {
    $('img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('src');
      
      // Allow CID images (inline attachments)
      if (src && !src.startsWith('cid:')) {
        hasBlockedImages = true;
        $img.replaceWith(`<span style="display:none;"><!-- blocked image: ${src} --></span>`);
      }
    });
  }

  const html = $.html();

  // Apply theme-specific styles
  const themeStyles = `
    <style type="text/css">
      :host {
        display: block;
        line-height: 1.5;
        background-color: ${isDarkTheme ? '#1A1A1A' : '#ffffff'};
        color: ${isDarkTheme ? '#ffffff' : '#000000'};
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
        color: ${isDarkTheme ? '#60a5fa' : '#2563eb'};
        text-decoration: underline;
      }

      table {
        border-collapse: collapse;
      }

      ::selection {
        background: #b3d4fc;
        text-shadow: none;
      }

      /* Styling for collapsed quoted text */
      details.quoted-toggle {
        border-left: 2px solid ${isDarkTheme ? '#374151' : '#d1d5db'};
        padding-left: 8px;
        margin-top: 0.75rem;
      }

      details.quoted-toggle summary {
        cursor: pointer;
        color: ${isDarkTheme ? '#9CA3AF' : '#6B7280'};
        list-style: none;
        user-select: none;
      }

      details.quoted-toggle summary::-webkit-details-marker {
        display: none;
      }

      [data-theme-color="muted"] {
        color: ${isDarkTheme ? '#9CA3AF' : '#6B7280'};
      }
    </style>
  `;

  const finalHtml = `${themeStyles}${html}`;

  return {
    processedHtml: finalHtml,
    hasBlockedImages,
  };
}

// Original function for backward compatibility
export function processEmailHtml({ html, shouldLoadImages, theme }: ProcessEmailOptions): {
  processedHtml: string;
  hasBlockedImages: boolean;
} {
  const preprocessed = preprocessEmailHtml(html);
  return applyEmailPreferences(preprocessed, theme, shouldLoadImages);
}
