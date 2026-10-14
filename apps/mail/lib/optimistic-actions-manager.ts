import type { ThreadDestination } from '@/lib/thread-actions';

type BasePendingAction = {
  id: string;
  type: 'MOVE' | 'STAR' | 'READ' | 'LABEL' | 'IMPORTANT' | 'SNOOZE' | 'UNSNOOZE';
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
    | { type: 'SNOOZE'; params: { currentFolder: string; wakeAt: string } }
    | { type: 'UNSNOOZE'; params: { currentFolder: string } }
  );

export class OptimisticActionsManager {
  pendingActions: Map<string, PendingAction> = new Map();
  pendingActionsByType: Map<string, Set<string>> = new Map();
  lastActionId: string | null = null;

  settleAction(id: string) {
    const action = this.pendingActions.get(id);
    if (!action) return undefined;
    this.pendingActions.delete(id);
    const actions = this.pendingActionsByType.get(action.type);
    actions?.delete(id);
    const typeDrained = !actions?.size;
    if (typeDrained) this.pendingActionsByType.delete(action.type);
    return { optimisticId: action.optimisticId, typeDrained };
  }
}

export const optimisticActionsManager = new OptimisticActionsManager();
