// utils/cleanEmailHtml.ts
import sanitizeHtml from 'sanitize-html';

export function cleanEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: false,
    allowedAttributes: {
      '*': ['href', 'src', 'alt', 'title', 'width', 'height'],
    },
    transformTags: {
      '*': (tagName, attribs) => {
        delete attribs.style;
        delete attribs.class;
    
        if (tagName === 'font') {
          return {
            tagName: 'span',
            attribs: {},
          };
        }
    
        return { tagName, attribs };
      },
    },    
    exclusiveFilter: (frame) =>
      frame.tag === 'style' ||
      frame.tag === 'script' ||
      frame.attribs?.['class']?.includes('gmail_extra'),
  });
}
export function stripTablePadding(html: string): string {
  return html
    .replace(/<tr[^>]*height=["']?3[02]["']?[^>]*><td[^>]*><\/td><\/tr>/gi, '')
    .replace(/<td[^>]*width=["']?8["']?[^>]*><\/td>/gi, '');
}
