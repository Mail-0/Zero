import type { Plugin } from '@/types/plugin';
import { Button } from '@/components/ui/button';
import React from 'react';

export const HelloWorldPlugin: Plugin = {
  metadata: {
    id: 'hello-world',
    name: 'Hello World Plugin',
    version: '0.0.1',
    description: 'A simple plugin that logs to the console.',
    author: 'Zero',
  },
  uiExtensions: [
    {
      location: 'composer-toolbar',
      component: <Button variant="outline" onClick={() => console.log('Hello from plugin!')}>Hello</Button>,
    },
  ],
  onActivate: async () => {
    console.log('Hello World Plugin activated!');
  },
  onDeactivate: async () => {
    console.log('Hello World Plugin deactivated!');
  },
};
