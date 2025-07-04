import type { ThreadDestination } from '@/lib/thread-actions';

type BasePendingAction = {
  id: string;
  threadIds: string[];
  optimisticId: string;
  execute: () => Promise<void>;
  undo: () => void;
  toastId?: string | number;
};

export type PendingAction = BasePendingAction &
  (
    | { type: 'MOVE'; params: { currentFolder: string; destination: ThreadDestination } }
    | { type: 'STAR'; params: { starred: boolean } }
    | { type: 'READ'; params: { read: boolean } }
    | { type: 'LABEL'; params: { labelId: string; add: boolean } }
    | { type: 'IMPORTANT'; params: { important: boolean } }
  );

class OptimisticActionsManager {
  pendingActions: Map<string, PendingAction> = new Map();
  pendingActionsByType: Map<string, Set<string>> = new Map();
  lastActionId: string | null = null;
}

export const optimisticActionsManager = new OptimisticActionsManager();
