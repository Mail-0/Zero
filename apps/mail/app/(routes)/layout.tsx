import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <HotkeyProviderWrapper>
      <div className="relative flex max-h-screen w-full overflow-hidden">
        <Outlet />
      </div>
    </HotkeyProviderWrapper>
  );
}
