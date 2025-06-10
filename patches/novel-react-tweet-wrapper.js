// Stub for react-tweet Tweet component since it's not available in client build
import React from 'react';

// Re-export everything from the client build that's available  
export * from 'react-tweet';

// Stub Tweet component
export const Tweet = ({ id }) => {
  return React.createElement('div', { 
    'data-twitter': true,
    style: { padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }
  }, `Tweet ${id} (twitter embed disabled)`);
};

export default Tweet;
