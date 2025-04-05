'use client'; // NextJS 13 requires this. Remove if you are using NextJS 12 or lower
import { useEffect } from 'react';
import Script from 'next/script';

interface FeaturebaseWidgetProps {
  organization?: string;
  theme?: 'light' | 'dark';
  placement?: 'right' | 'left';
  email?: string;
  defaultBoard?: string;
  locale?: string;
  metadata?: any;
}

const FeaturebaseWidget = ({
  organization = '0email', // Replace with your organization name
  theme = 'light',
  placement, // Removed default value to hide the floating button
  email,
  defaultBoard,
  locale = 'en',
  metadata = null,
}: FeaturebaseWidgetProps) => {
  useEffect(() => {
    const win = window as any;

    if (typeof win.Featurebase !== 'function') {
      win.Featurebase = function () {
        // eslint-disable-next-line prefer-rest-params
        (win.Featurebase.q = win.Featurebase.q || []).push(arguments);
      };
    }

    win.Featurebase('initialize_feedback_widget', {
      organization,
      theme,
      // Removed placement to hide the floating button
      email, // optional
      defaultBoard, // optional - preselect a board
      locale, // Change the language
      metadata, // Attach session-specific metadata to feedback
    });
  }, [organization, theme, placement, email, defaultBoard, locale, metadata]);

  return (
    <Script
      src="https://do.featurebase.app/js/sdk.js"
      id="featurebase-sdk"
      strategy="afterInteractive"
    />
  );
};

export default FeaturebaseWidget;
