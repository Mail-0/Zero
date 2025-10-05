# Template Variable Color Coding

This document explains the color coding system for template variables in CedarMail.

## Overview

Template variables in CedarMail are now color-coded based on their type/prefix to make them easier to distinguish and understand at a glance.

## Configuration

The color scheme is defined in `/apps/mail/config/template-colors.json`:

```json
{
  "variableColors": {
    "default": {
      "background": "bg-primary/20",
      "text": "text-primary",
      "description": "Default color for regular template variables"
    },
    "@calendar": {
      "background": "bg-blue-100 dark:bg-blue-900/30",
      "text": "text-blue-700 dark:text-blue-300",
      "description": "Calendar-related variables"
    },
    "@knowledge base": {
      "background": "bg-emerald-100 dark:bg-emerald-900/30",
      "text": "text-emerald-700 dark:text-emerald-300",
      "description": "Knowledge base queries"
    }
  }
}
```

## Variable Types

### Default Variables (Blue/Primary)

- `{first_name}` - Contact's first name
- `{company}` - Company name
- `{topic}` - Email topic/subject
- `{my_name}` - Sender's name
- All other standard template variables

### Calendar Variables (Blue)

- `{@Calendar: suggest 3 times next week}` - Calendar scheduling
- `{@Calendar: check availability}` - Availability checking
- Any variable starting with `@calendar` (case insensitive)

### Knowledge Base Variables (Green)

- `{@Knowledge Base: similar company we sell to}` - Knowledge base queries
- `{@Knowledge Base: compliance issue}` - Contextual information lookup
- Any variable starting with `@knowledge base` (case insensitive)

### Additional Types

The system supports additional types like:

- `@email` - Email-related context (Purple)
- `@contact` - Contact information (Orange)
- `@company` - Company information (Indigo)

## Usage

### In Components

Use the `renderTemplateContent` utility function:

```tsx
import { renderTemplateContent } from '@/lib/template-utils';

function MyComponent() {
  const templateContent = "Hi {first_name}, let's schedule {@Calendar: suggest times}";

  return <div className="whitespace-pre-wrap">{renderTemplateContent(templateContent)}</div>;
}
```

### Utility Functions

The `/apps/mail/lib/template-utils.tsx` file provides several helper functions:

- `renderTemplateContent(content: string)` - Renders template with colors
- `getVariableColorScheme(variableType: string)` - Gets color scheme for a type
- `extractTemplateVariables(content: string)` - Extracts all variables from content
- `getVariableTypes()` - Returns all available variable types

## Adding New Variable Types

1. Add the new type to `/apps/mail/config/template-colors.json`:

```json
{
  "variableColors": {
    "@newtype": {
      "background": "bg-purple-100 dark:bg-purple-900/30",
      "text": "text-purple-700 dark:text-purple-300",
      "description": "Description of the new type"
    }
  }
}
```

2. The system automatically detects variables starting with the new prefix.

## Dark Mode Support

All color schemes include dark mode variants using Tailwind's `dark:` prefix:

- Light mode: `bg-blue-100 text-blue-700`
- Dark mode: `dark:bg-blue-900/30 dark:text-blue-300`

## Implementation Details

- Variables are detected using regex: `/(\{[^}]+\})/g`
- Matching is case-insensitive for prefixes
- The first matching prefix wins (order matters in JSON)
- Tooltips show the variable type description on hover
- All Tailwind classes are included in the build automatically
