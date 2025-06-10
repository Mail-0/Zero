import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import type { MoveThreadOptions } from '@/lib/thread-actions';

const useMoveTo = () => {
  const { optimisticMoveThreadsTo } = useOptimisticActions();

  const mutate = ({ threadIds, currentFolder, destination }: MoveThreadOptions) => {
    optimisticMoveThreadsTo(threadIds, currentFolder, destination);
  };

  return {
    mutate,
    isLoading: false,
  };
};

export default useMoveTo;
