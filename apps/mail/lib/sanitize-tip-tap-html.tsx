import { renderToString } from 'react-dom/server';
import { Html } from '@react-email/components';
import sanitizeHtml from 'sanitize-html';

export const sanitizeTipTapHtml = async (html: string) => {
  const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ['http', 'https', 'cid', 'data'],
  });

  return renderToString(
    <Html>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
    </Html>,
  );
};
