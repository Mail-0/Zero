import { atom } from 'jotai';

const baseBackgroundQueueAtom = atom<Set<string>>(new Set<string>());

export const backgroundQueueAtom = atom(
  (get) => Array.from(get(baseBackgroundQueueAtom)),
  (get, set, action: { type: 'add' | 'delete' | 'clear'; threadId?: string }) => {
    const currentQueue = get(baseBackgroundQueueAtom);
    if (action.type === 'add' && action.threadId && !currentQueue.has(action.threadId)) {
      set(baseBackgroundQueueAtom, new Set([...currentQueue, action.threadId]));
    } else if (action.type === 'delete' && action.threadId) {
      const newQueue = new Set(currentQueue);
      newQueue.delete(action.threadId);
      set(baseBackgroundQueueAtom, newQueue);
    } else if (action.type === 'clear') {
      set(baseBackgroundQueueAtom, new Set<string>());
    }
  },
);

export const isThreadInBackgroundQueueAtom = atom(
  (get) => (threadId: string) => get(baseBackgroundQueueAtom).has(threadId),
);
