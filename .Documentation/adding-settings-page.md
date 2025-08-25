# Adding a New Settings Page

This guide explains how to add a new settings section to the Mail app, including all files to touch and routing considerations.

## Overview
There are two ways settings pages are rendered today:

- __Centralized (catch-all)__: `apps/mail/app/(routes)/settings/[...settings]/page.tsx` imports all section components and chooses which one to render based on the URL segment.
- __Explicit routes__: `apps/mail/app/routes.ts` can map specific paths (e.g., `/settings/plugins`) directly to a file.

You can use either approach, but be consistent. If you choose explicit routes, consider removing the mapping for that section in the catch-all, or ensure both resolve to the same component.

## 1) Create the section component
Create a new directory for your section and export a React component.

Path:
- `apps/mail/app/(routes)/settings/<your-section>/page.tsx`

Example (`apps/mail/app/(routes)/settings/account/page.tsx`):

```tsx
import { SettingsCard } from '@/components/settings/settings-card';
import { m } from '@/paraglide/messages';

export default function AccountSettingsPage() {
  return (
    <div className="grid gap-6">
      <SettingsCard
        title={m['pages.settings.account.title']?.() ?? 'Account'}
        description={m['pages.settings.account.description']?.() ?? 'Manage your account settings.'}
      >
        {/* Your account settings UI here */}
        <div>Account settings content</div>
      </SettingsCard>
    </div>
  );
}
```

Notes:
- Use `SettingsCard` to match existing settings UI.
- If you rely on translations, add keys in `@/paraglide/messages` (e.g., `pages.settings.account.*`).

## 2A) Centralized rendering via catch‑all (current default)
If you want the catch‑all route to render your new section:

Edit `apps/mail/app/(routes)/settings/[...settings]/page.tsx`:

- Import your component
- Add it to the `settingsPages` map with the key matching the URL segment

```tsx
// imports at top
import AccountSettingsPage from '../account/page';

// inside file
const settingsPages: Record<string, React.ComponentType> = {
  // ...existing entries
  account: AccountSettingsPage,
};
```

How it works:
- The route `[...settings]/page.tsx` reads `useParams()` and resolves the first segment of the `settings` catch‑all to `section`.
- It then picks `settingsPages[section]` and renders it.

URL:
- `/settings/account` → renders `AccountSettingsPage` via the catch‑all.

No changes to `routes.ts` are required for this option.

## 2B) Explicit route (alternative)
If you prefer an explicit route for your section:

Edit `apps/mail/app/routes.ts` and add a route inside the `prefix('/settings', [...])` block, BEFORE the catch‑all `route('/*', ...)` line to ensure correct precedence.

```ts
route('/account', '(routes)/settings/account/page.tsx'),
```

Example context (abbreviated):

```ts
layout(
  '(routes)/settings/layout.tsx',
  prefix('/settings', [
    index('(routes)/settings/page.tsx'),
    // ...other explicit settings routes
    route('/account', '(routes)/settings/account/page.tsx'),
    route('/*', '(routes)/settings/[...settings]/page.tsx'),
  ]),
);
```

URL:
- `/settings/account` → mounts `apps/mail/app/(routes)/settings/account/page.tsx` directly.

Tip:
- If you use an explicit route, you can optionally remove the same key from `settingsPages` in the catch‑all to avoid duplicate definitions.

## 3) Verify locally
- Start dev: `pnpm go` (runs `react-router dev --port 3500` for Mail)
- Navigate to your page: `http://localhost:3500/settings/account`
- Open browser console. You should see logging from `[...settings]/page.tsx` if using the catch‑all (e.g., `Displaying section: account`).

## 4) Optional: i18n
- If using `m['...']()` keys from `@/paraglide/messages`, add corresponding strings in your messages setup so titles/descriptions render properly.

## 5) Optional: Navigation
- If you maintain a visible settings navigation, add a link to your new section there so it’s discoverable.

## Summary
- Create your component under `apps/mail/app/(routes)/settings/<section>/page.tsx`.
- EITHER add it to `settingsPages` in `apps/mail/app/(routes)/settings/[...settings]/page.tsx` (centralized), OR define an explicit route in `apps/mail/app/routes.ts` before the catch‑all (decentralized).
- Keep the approach consistent across settings sections to minimize confusion and routing conflicts.
