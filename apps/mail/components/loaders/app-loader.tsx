'use client';

import BaseLoader from './base-loader';

const loaderLines = [
  'Analyzing your email patterns for a personalized experience...',
  'Training our AI to draft replies in your style...',
  'Optimizing your inbox for maximum productivity...',
  'Filtering out the noise so you can focus on what matters...',
  'Getting your digital assistant ready for the day...',
];

const AppLoader = ({ theme }: { theme?: 'light' | 'dark' }) => {
  return <BaseLoader theme={theme} loaderLines={loaderLines} />;
};

export default AppLoader;
