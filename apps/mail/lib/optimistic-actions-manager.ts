export type PendingAction = {
  id: string;
  type: 'MOVE' | 'STAR' | 'READ' | 'LABEL' | 'IMPORTANT';
  threadIds: string[];
  params: any;
  optimisticId: string;
  execute: () => Promise<void>;
  undo: () => void;
  toastId?: string | number;
};

class OptimisticActionsManager {
  pendingActions: Map<string, PendingAction> = new Map();
  pendingActionsByType: Map<string, Set<string>> = new Map();
  lastActionId: string | null = null;
}

export const optimisticActionsManager = new OptimisticActionsManager();
