import { Html } from '@react-email/components';
import { render } from '@react-email/render';
import sanitizeHtml from 'sanitize-html';
import { v4 as uuidv4 } from 'uuid';
import React from 'react';

interface InlineImage {
  cid: string;
  data: string;
  mimeType: string;
}

export const sanitizeTipTapHtml = async (
  html: string,
): Promise<{ html: string; inlineImages: InlineImage[] }> => {
  const inlineImages: InlineImage[] = [];

  const processedHtml = html.replace(
    /<img[^>]+src=["']data:([^;]+);base64,([^"']+)["'][^>]*>/gi,
    (match, mimeType, base64Data) => {
      const cid = `image_${uuidv4()}@0.email`;
      inlineImages.push({
        cid,
        data: base64Data,
        mimeType,
      });

      return match.replace(/src=["']data:[^"']+["']/i, `src="cid:${cid}"`);
    },
  );

  const clean = sanitizeHtml(processedHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'width', 'height', 'style'],
    },
    allowedSchemes: ['http', 'https', 'cid', 'data'],
  });

  const renderedHtml = await render(
    React.createElement(
      Html,
      {},
      React.createElement('div', { dangerouslySetInnerHTML: { __html: clean } }),
    ) as any,
  );

  return {
    html: renderedHtml,
    inlineImages,
  };
};
