import { Html } from '@react-email/components';
import { render } from '@react-email/render';
import sanitizeHtml from 'sanitize-html';

export const sanitizeTipTapHtml = async (html: string) => {
  const clean = sanitizeHtml(html);

  return render(
    <Html>
      <div dangerouslySetInnerHTML={{ __html: clean }} />
    </Html>,
  );
};
