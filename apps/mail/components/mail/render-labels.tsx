'use client';

import * as React from 'react';
import { Label, useThreadLabels } from '@/hooks/use-labels';

export const RenderLabels = ({ ids }: { ids: string[] }) => {
  const { data: labels = [] } = useThreadLabels(ids);

  return labels.map((label: Label) => (
    <span
      key={label.id}
      className="bg-primary/10 text-primary rounded px-1.5 py-0.5"
      style={{ backgroundColor: label.color?.backgroundColor, color: label.color?.textColor }}
    >
      {label.name}
    </span>
  ));
};
