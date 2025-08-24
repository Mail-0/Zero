import { useDoState } from '@/components/mail/use-do-state';

export const useStats = () => {
  const [doState] = useDoState();
  return { data: doState.counts };
};
