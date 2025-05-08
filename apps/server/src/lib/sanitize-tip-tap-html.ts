import { Html } from '@react-email/components';
import { render } from '@react-email/render';
import sanitizeHtml from 'sanitize-html';
import React from 'react';

export const sanitizeTipTapHtml = async (html: string) => {
  const clean = sanitizeHtml(html);
  return render(
    React.createElement(
      Html,
      {},
      React.createElement('div', { dangerouslySetInnerHTML: { __html: clean } }),
    ),
  );
};
