import { PopupThreadDisplay } from '@/components/mail/popup-thread-display';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useQueryState } from 'nuqs';

export default function ThreadPopup() {
  const [searchParams] = useSearchParams();
  const threadId = searchParams.get('threadId');
  const [, setThreadId] = useQueryState('threadId');
  
  // Set the thread ID from URL query parameter
  useEffect(() => {
    if (threadId) {
      setThreadId(threadId);
    }
  }, [threadId, setThreadId]);

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