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

  const validatedTheme: 'light' | 'dark' = theme === 'dark' ? 'dark' : 'light';
  const isDarkTheme = validatedTheme === 'dark';

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

  const collapseQuoted = (selector: string) => {
    $(selector).each((_, el) => {
      const $el = $(el);
      if ($el.parents('details.quoted-toggle').length) return;

      const innerHtml = $el.html();
      if (typeof innerHtml !== 'string') return;
      const detailsHtml = `<details class="quoted-toggle" style="margin-top:1em;">
          <summary style="cursor:pointer; color:${isDarkTheme ? '#9CA3AF' : '#6B7280'};">
            Show quoted text
          </summary>
          ${innerHtml}
        </details>`;

      $el.replaceWith(detailsHtml);
    });
  };

  collapseQuoted('blockquote');
  collapseQuoted('.gmail_quote');

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
        // width: 100%;
        // height: 100%;
        // overflow: auto;
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
    </style>
  `;

  const fullHtml = $.html();

  const finalHtml = `${minimalStyles}${fullHtml}`;

  return {
    processedHtml: finalHtml,
    hasBlockedImages,
  };
}
