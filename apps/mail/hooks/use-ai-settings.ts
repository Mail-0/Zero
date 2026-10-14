import { defaultAiSettings, type AiSettings } from '@zero/server/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { useSettings } from '@/hooks/use-settings';
import { toast } from 'sonner';

/** The user's background AI settings, with a save that merges into stored settings. */
export function useAiSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSettings();
  const settings: AiSettings = { ...defaultAiSettings, ...data?.settings.ai };

  const { mutateAsync, isPending } = useMutation(trpc.settings.save.mutationOptions());

  const save = async (patch: Partial<AiSettings>) => {
    if (!data) return;
    const ai = { ...settings, ...patch };
    const key = trpc.settings.get.queryKey();
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, { settings: { ...data.settings, ai } });
    try {
      await mutateAsync({ ai });
      // Summary visibility follows the toggle.
      await queryClient.invalidateQueries({ queryKey: trpc.brain.generateSummary.pathKey() });
    } catch (error) {
      queryClient.setQueryData(key, previous);
      toast.error('Failed to save AI settings');
      throw error;
    }
  };

  return { settings, save, isLoading, isSaving: isPending };
}
