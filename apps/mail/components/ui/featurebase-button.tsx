'use client';

import React from 'react';

const FeaturebaseButton = () => {
  return (
    <button
      data-featurebase-feedback
      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      Open Feedback
    </button>
  );
};

export default FeaturebaseButton;
