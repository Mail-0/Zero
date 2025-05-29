import type { ThreadDestination } from '@/lib/thread-actions';
import { atom } from 'jotai';

export type OptimisticAction =
  | { type: 'MOVE'; threadIds: string[]; destination: ThreadDestination }
  | { type: 'STAR'; threadIds: string[]; starred: boolean }
  | { type: 'READ'; threadIds: string[]; read: boolean }
  | { type: 'LABEL'; threadIds: string[]; labelIds: string[]; add: boolean }
  | { type: 'IMPORTANT'; threadIds: string[]; important: boolean };

export const optimisticActionsAtom = atom<Record<string, OptimisticAction>>({});

export const generateOptimisticId = () =>
  `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const isThreadAffectedByOptimisticAction = (threadId: string, actionType?: string) =>
  atom((get) => {
    const actions = get(optimisticActionsAtom);
    return Object.values(actions).some((action) => {
      if (actionType && action.type !== actionType) return false;
      return action.threadIds.includes(threadId);
    });
  });

export const getThreadOptimisticActions = (threadId: string) =>
  atom((get) => {
    const actions = get(optimisticActionsAtom);
    return Object.entries(actions)
      .filter(([_, action]) => action.threadIds.includes(threadId))
      .map(([id, action]) => ({ id, ...action }));
  });

export const addOptimisticActionAtom = atom(null, (get, set, action: OptimisticAction) => {
  const id = generateOptimisticId();
  const currentActions = get(optimisticActionsAtom);
  set(optimisticActionsAtom, {
    ...currentActions,
    [id]: action,
  });
  return id;
});

export const removeOptimisticActionAtom = atom(null, (get, set, id: string) => {
  const currentActions = get(optimisticActionsAtom);
  const { [id]: _, ...rest } = currentActions;
  set(optimisticActionsAtom, rest);
});
