import { type OptimisticAction } from '@/store/optimistic-updates';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { optimisticActionsAtom } from '@/store/optimistic-updates';

export function useOptimisticThreadState(threadId: string) {
  const allOptimisticActions = useAtomValue(optimisticActionsAtom);

  const { isAffectedByOptimisticAction, optimisticActions } = useMemo(() => {
    const actions = Object.values(allOptimisticActions).filter((action) =>
      action.threadIds.includes(threadId),
    ) as OptimisticAction[];

    return {
      isAffectedByOptimisticAction: actions.length > 0,
      optimisticActions: actions,
    };
  }, [allOptimisticActions, threadId]);

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
      }
    });

    return states;
  }, [isAffectedByOptimisticAction, optimisticActions]);

  return {
    ...optimisticStates,
    hasOptimisticState: isAffectedByOptimisticAction,
  };
}
