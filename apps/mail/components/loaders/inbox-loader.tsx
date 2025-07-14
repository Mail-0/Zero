'use client';

import BaseLoader from './base-loader';

const loaderLines = [
  'Loading your inbox...',
  'Loading your drafts...',
  'Loading your sent items...',
  'Loading your trash...',
  'Loading your spam...',
];

const InboxLoader = () => {
  return <BaseLoader loaderLines={loaderLines} />;
};

export default InboxLoader;
