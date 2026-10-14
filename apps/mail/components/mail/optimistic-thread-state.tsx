import { type OptimisticAction } from '@/store/optimistic-updates';
import { atom, useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useMemo } from 'react';

import { optimisticActionsAtom } from '@/store/optimistic-updates';

const EMPTY: OptimisticAction[] = [];

const sameActions = (a: OptimisticAction[], b: OptimisticAction[]) =>
  a.length === b.length && a.every((action, i) => action === b[i]);

/**
 * Actions indexed by thread id, built once per change of the action set. Every mounted list
 * row selects from this instead of scanning all actions itself (O(actions) per row).
 */
const actionsByThreadAtom = atom((get) => {
  const byThread = new Map<string, OptimisticAction[]>();
  for (const action of Object.values(get(optimisticActionsAtom))) {
    for (const threadId of action.threadIds) {
      const list = byThread.get(threadId);
      if (!list) byThread.set(threadId, [action]);
      else if (list[list.length - 1] !== action) list.push(action);
    }
  }
  return byThread;
});

export function useOptimisticThreadState(threadId: string) {
  // Only re-render when *this* thread's actions change, not on every optimistic action
  // anywhere (e.g. mark-as-read on click would otherwise re-render every list row).
  const threadActionsAtom = useMemo(
    () =>
      selectAtom(actionsByThreadAtom, (byThread) => byThread.get(threadId) ?? EMPTY, sameActions),
    [threadId],
  );
  const optimisticActions = useAtomValue(threadActionsAtom);
  const isAffectedByOptimisticAction = optimisticActions.length > 0;

  const optimisticStates = useMemo(() => {
    const states = {
      isMoving: false,
      isStarring: false,
      isMarkingAsRead: false,
      isAddingLabel: false,
      isRemoving: false,
      shouldHide: false,
      isImportant: false,
      optimisticStarred: null as boolean | null,
      optimisticRead: null as boolean | null,
      optimisticDestination: null as string | null,
      optimisticImportant: null as boolean | null,
      optimisticLabels: {
        addedLabelIds: [] as string[],
        removedLabelIds: [] as string[],
      },
    };

    if (!isAffectedByOptimisticAction || !optimisticActions || optimisticActions.length === 0) {
      return states;
    }

    optimisticActions.forEach((action: OptimisticAction) => {
      switch (action.type) {
        case 'MOVE':
          states.isMoving = true;
          states.optimisticDestination = action.destination;
          states.shouldHide = true;
          break;

        case 'STAR':
          states.isStarring = true;
          states.optimisticStarred = action.starred;
          break;

        case 'READ':
          states.isMarkingAsRead = true;
          states.optimisticRead = action.read;
          break;

        case 'LABEL':
          states.isAddingLabel = action.add;
          if (action.add) {
            states.optimisticLabels.addedLabelIds.push(...action.labelIds);
          } else {
            states.optimisticLabels.removedLabelIds.push(...action.labelIds);
          }
          break;

        case 'IMPORTANT':
          states.isImportant = true;
          states.optimisticImportant = action.important;
          break;

        case 'SNOOZE':
          states.shouldHide = true;
          states.optimisticDestination = 'snoozed';
          break;

        case 'UNSNOOZE':
          states.shouldHide = true;
          states.optimisticDestination = 'inbox';
          break;
      }
    });

    return states;
  }, [isAffectedByOptimisticAction, optimisticActions]);

  return {
    ...optimisticStates,
    hasOptimisticState: isAffectedByOptimisticAction,
  };
}
