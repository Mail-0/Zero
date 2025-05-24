import { renderToString } from 'react-dom/server';
import { Html } from '@react-email/components';
import sanitizeHtml from 'sanitize-html';

export const sanitizeTipTapHtml = async (html: string) => {
  const clean = sanitizeHtml(html);

  return renderToString(
    <Html>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
    </Html>,
  );
};
