# Translation Guide for 0.email

[![Crowdin](https://badges.crowdin.net/0email/localized.svg)](https://crowdin.com/project/0email)

We use [Crowdin](https://crowdin.com/project/0email) to manage translations for 0.email. This document explains how you can contribute to translating the application into your language.

## Getting Started

1. Visit our [Crowdin project page](https://crowdin.com/project/0email)
2. Create an account
3. Choose your language from the list
4. Click on "Join" to apply to the translation team
5. In your application description, **include your Discord tag and the language(s) you want to help with** for communication and to be added to the translators community

If the language you'd like to help with isn't listed, you can open an issue and mention [@needleXO](https://github.com/needleXO)

## Translation Process

We will go through the process as soon as possible. Once you have been accepted, you should get a Direct Message from `@zerodotemail` on Discord

1. After your application is approved, you'll be able to see the files that need translation
2. Select a file to start translating
3. Translate the strings by filling in the target language field for each source string
4. Save your translations

## Translation Guidelines

### Maintaining Format Tags

Our application uses React, which requires maintaining special tags and placeholders in translations:

- **Do not modify variables** like `{count}`, `{language}`, or similar placeholders
- **Preserve formatting tags** such as `<strong>`, `<em>`, etc.
- **Keep plural forms** such as `{count, plural, =0 {files} one {file} other {files}}`

### Example Translation

Here's an example from our English locale file:

```json
"attachmentCount": "{count, plural, =0 {attachments} one {attachment} other {attachments}}",
```

In this example:

- `{count}` is a variable that should not be translated
- `plural` is a formatter that handles pluralization
- The words inside `{}` should be translated, but the structure must remain intact

### Testing Your Translations

You can see your translations in context by:

1. Making sure your translations are saved in Crowdin
2. Waiting for the project maintainers to approve and merge the translations
3. Testing the application in your language (follow the [Quick Start Guide](../README.md#quick-start-guide) to set up the app locally)

## Need Help?

If you have any questions about translation or encounter any issues, please [open an issue](https://github.com/Mail-0/Zero/issues) or join our [Discord server](https://discord.gg/NaK85MSzND)

Thank you for helping make 0.email accessible to users in your language!
