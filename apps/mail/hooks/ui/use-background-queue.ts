import { backgroundQueueAtom } from '@/store/backgroundQueue';
import { useAtom } from 'jotai';

const useBackgroundQueue = () => {
  const [backgroundQueue, setBackgroundQueue] = useAtom(backgroundQueueAtom);

  return {
    addToQueue: (threadId: string) =>
      setBackgroundQueue({
        type: 'add',
        threadId: threadId.startsWith('thread:') ? threadId : `thread:${threadId}`,
      }),
    deleteFromQueue: (threadId: string) =>
      setBackgroundQueue({
        type: 'delete',
        threadId: threadId.startsWith('thread:') ? threadId : `thread:${threadId}`,
      }),
    clearQueue: () => setBackgroundQueue({ type: 'clear' }),
    queue: backgroundQueue,
  };
};

export default useBackgroundQueue;
