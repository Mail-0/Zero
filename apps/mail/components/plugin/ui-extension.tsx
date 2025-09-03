'use client';

import { usePlugins } from '@/hooks/use-plugins';
import { Fragment } from 'react';

export interface UIExtensionProps {
  location: string;
}

export const UIExtension = ({ location }: UIExtensionProps) => {
  const { getUIExtensions } = usePlugins();
  const extensions = getUIExtensions(location);

  if (!extensions.length) {
    return null;
  }

  return (
    <Fragment>
      {extensions.map((extension, index) => (
        <Fragment key={`${extension.pluginId}-${index}`}>{extension.component}</Fragment>
      ))}
    </Fragment>
  );
};
