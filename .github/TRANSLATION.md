# Translation Guide for 0.email

[![Localization](https://img.shields.io/badge/Localization-Lingo.dev-5fcc03)](https://lingo.dev)

We use [Lingo.dev](https://github.com/lingodotdev/lingo.dev) to manage translations for 0.email. This document explains how our translation workflow operates.

## Overview

Lingo.dev is an open-source CLI + AI Localization Engine that helps translate our product into multiple languages with great developer experience. It integrates directly with our development workflow through a CLI tool and GitHub Actions.

## Translation Process

Our translation process is fully automated:

1. Developers add or update content in the English source files (`en.json`)
2. GitHub Actions automatically runs the Lingo.dev CLI on commits
3. Lingo.dev's managed translation AI automatically generates translations for all target languages, taking into account translation memory and our product's context, configured in our Lingo.dev dashboard
4. Updated translations are committed back to the repository

## Our Configuration

Here's an example of our i18n.json configuration:

```json
{
  "$schema": "https://lingo.dev/schema/i18n.json",
  "version": 1.5,
  "locale": {
    "source": "en",
    "targets": ["ar", "de", "es", "fr", "hi"]
  },
  "buckets": {
    "json": {
      "include": ["apps/mail/locales/[locale].json"]
    }
  }
}
```

## Adding a New Language

To add support for a new language:

1. Add the language code to the `targets` array in `i18n.json` in the project root
2. Also add the language to the i18n config in `apps/mail/i18n/config.ts`
3. The GitHub Action will automatically generate missing translations when you commit these changes

## Automatic Translation of New Content

When new phrases are added or updated in `en.json`, they will be automatically localized in all other languages through our GitHub Action workflow. The Lingo.dev CLI detects changes and only translates what's new or modified.

## Updating Translations

If you want to manually update a translation:

1. Go to the non-English translation file (e.g., `es.json` for Spanish, `de.json` for German)
2. Find the key you want to update and change its value
3. Commit the change to the repository
4. Lingo.dev will remember this override and reuse it for future translations

Example:

```json
// Before manual update in de.json
"welcomeMessage": "Willkommen bei 0.email"

// After manual update in de.json
"welcomeMessage": "Herzlich willkommen bei 0.email"
```

Your manual override will be preserved during future translation runs, and Lingo.dev will learn from these changes to improve future translations.

## GitHub Actions Integration

We use the Lingo.dev GitHub Action to automate translations in our CI/CD pipeline. The action is configured to:

1. Run automatically on push to feature branches
2. Generate translations for any new or modified content
3. Commit the updated translation files back to the repository, via a PR

This setup means developers only need to focus on maintaining the English source content. The translation process happens automatically in the background.

## Translation Guidelines

### Handling Variables and Formatting

When updating translations manually, ensure:

- **Variables remain intact**: Placeholders like `{count}`, `{email}` must not be modified
- **Formatting tags are preserved**: Tags like `<strong>`, `<em>` should remain in the translated text
- **Plural forms are maintained**: Structures like `{count, plural, =0 {files} one {file} other {files}}` must keep their format

### Example Translation

English source:

```json
"attachmentCount": "{count, plural, =0 {attachments} one {attachment} other {attachments}}",
```

The AI will translate only the words inside the curly braces while maintaining the structure.

## Need Help?

If you have questions about translation or encounter issues, please [open an issue](https://github.com/Mail-0/Zero/issues) or join our [Discord server](https://discord.gg/mail0).

Thank you for helping make 0.email accessible to users in your language!
