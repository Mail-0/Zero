import { PopupThreadDisplay } from '@/components/mail/popup-thread-display';
import { useEffect } from 'react';

export default function ThreadPopup() {
  // Set the page title
  useEffect(() => {
    document.title = `Thread - Zero`;
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="h-full w-full">
        <PopupThreadDisplay />
      </div>
    </div>
  );
} 