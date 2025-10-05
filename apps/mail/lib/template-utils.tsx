import templateColors from '@/config/template-colors.json';
import React from 'react';

/**
 * Renders template content with color-coded variables
 * @param content - The template content string containing variables in {variable} format
 * @returns JSX elements with properly colored template variables
 */
export function renderTemplateContent(content: string): React.ReactNode[] {
  const parts = content.split(/(\{[^}]+\})/g);

  return parts.map((part, index) => {
    if (part.match(/^\{.*\}$/)) {
      // Extract the variable content without braces
      const variableContent = part.slice(1, -1);

      // Determine color scheme based on variable prefix
      let colorScheme = templateColors.variableColors.default;

      // Check for special prefixes (case insensitive)
      for (const [prefix, colors] of Object.entries(templateColors.variableColors)) {
        if (
          prefix !== 'default' &&
          variableContent.toLowerCase().startsWith(prefix.toLowerCase())
        ) {
          colorScheme = colors;
          break;
        }
      }

      return (
        <span
          key={`${part}-${index}`}
          className={`${colorScheme.background} ${colorScheme.text} rounded px-1`}
          title={colorScheme.description}
        >
          {part}
        </span>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

/**
 * Gets the color scheme for a specific template variable type
 * @param variableType - The type of variable (e.g., '@calendar', '@knowledge base', etc.)
 * @returns The color scheme object for the variable type
 */
export function getVariableColorScheme(variableType: string) {
  const normalizedType = variableType.toLowerCase();

  for (const [prefix, colors] of Object.entries(templateColors.variableColors)) {
    if (prefix !== 'default' && normalizedType.startsWith(prefix.toLowerCase())) {
      return colors;
    }
  }

  return templateColors.variableColors.default;
}

/**
 * Extracts all template variables from content
 * @param content - The template content string
 * @returns Array of variable strings (including the braces)
 */
export function extractTemplateVariables(content: string): string[] {
  const matches = content.match(/\{[^}]+\}/g);
  return matches || [];
}

/**
 * Gets all available variable types and their color schemes
 * @returns Object mapping variable types to their color schemes
 */
export function getVariableTypes() {
  return templateColors.variableColors;
}
