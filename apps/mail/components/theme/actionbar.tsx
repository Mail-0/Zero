import { SaveThemeDialog } from './save-theme-dialog';

export function ActionBar() {
  return (
    <div className="border-b">
      <div className="flex h-14 items-center justify-end gap-4 px-4">
        <SaveThemeDialog />
      </div>
    </div>
  );
}
