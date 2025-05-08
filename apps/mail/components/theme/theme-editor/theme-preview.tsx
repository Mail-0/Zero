'use client';

import { ThemeSettings } from '@zero/db/schema';

interface ThemePreviewProps {
  settings: ThemeSettings;
}

export function ThemePreview({ settings }: ThemePreviewProps) {
  const previewStyle = {
    // Apply theme settings to preview
    backgroundColor: settings.colors.background,
    color: settings.colors.foreground,
    padding: `${settings.spacing.padding}px`,
    margin: `${settings.spacing.margin}px`,
    borderRadius: `${settings.cornerRadius}px`,
    boxShadow: `0 0 ${settings.shadows.intensity}px ${settings.shadows.color}`,
    fontFamily: settings.fonts.family,
    fontSize: `${settings.fonts.size}px`,
    fontWeight: settings.fonts.weight,
    background: settings.background.type === 'color' 
      ? settings.background.value 
      : settings.background.type === 'gradient'
        ? settings.background.value
        : `url(${settings.background.value})`,
    backgroundSize: settings.background.type === 'image' ? 'cover' : undefined,
  };

  const buttonStyle = {
    backgroundColor: settings.colors.primary,
    color: '#FFFFFF',
    padding: '10px 15px',
    borderRadius: `${settings.cornerRadius}px`,
    border: 'none',
    cursor: 'pointer',
    fontFamily: settings.fonts.family,
    fontWeight: settings.fonts.weight,
  };

  const cardStyle = {
    backgroundColor: settings.colors.muted,
    borderRadius: `${settings.cornerRadius}px`,
    padding: `${settings.spacing.padding}px`,
    boxShadow: `0 0 ${Math.max(5, settings.shadows.intensity / 2)}px ${settings.shadows.color}`,
    border: `1px solid ${settings.colors.border}`,
  };

  return (
    <div className="theme-preview max-w-md mx-auto" style={previewStyle}>
      <div className="preview-header" style={{ marginBottom: `${settings.spacing.margin}px` }}>
        <h2 style={{ color: settings.colors.primary, fontSize: `${settings.fonts.size + 6}px` }}>
          Theme Preview
        </h2>
        <p style={{ color: settings.colors.secondary }}>
          This is how your theme will look
        </p>
      </div>

      <div className="preview-content" style={cardStyle}>
        <h3 style={{ 
          color: settings.colors.foreground, 
          fontSize: `${settings.fonts.size + 2}px`,
          marginBottom: `${settings.spacing.margin / 2}px` 
        }}>
          Sample Card
        </h3>
        <p style={{ 
          color: settings.colors.secondary,
          marginBottom: `${settings.spacing.margin}px` 
        }}>
          This is sample content to demonstrate how your theme settings will appear.
        </p>
        <div className="button-row" style={{ display: 'flex', gap: '10px' }}>
          <button style={buttonStyle}>Primary Button</button>
          <button style={{ 
            ...buttonStyle, 
            backgroundColor: settings.colors.secondary,
            color: settings.colors.background,
          }}>
            Secondary
          </button>
        </div>
      </div>
    </div>
  );
} 