import { toast } from 'sonner';
import useSWR from 'swr';

export interface Label {
  id?: string;
  name: string;
  type?: string;
  color?: {
    backgroundColor: string;
    textColor: string;
  };
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch labels');
  }
  return response.json();
};

export function useLabels() {
  const { data: labels, error, isLoading, mutate } = useSWR<Label[]>('/api/v1/labels', fetcher);

  const createLabel = async (label: Omit<Label, 'id' | 'type'>) => {
    try {
      const response = await fetch('/api/v1/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(label),
      });

      if (!response.ok) {
        throw new Error('Failed to create label');
      }

      const newLabel = await response.json();
      await mutate([...(labels || []), newLabel], false);
      toast.success('Label created successfully');
      return newLabel;
    } catch (error) {
      toast.error('Failed to create label');
      throw error;
    }
  };

  const updateLabel = async (id: string, label: Partial<Omit<Label, 'id' | 'type'>>) => {
    try {
      const response = await fetch('/api/v1/labels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...label }),
      });

      if (!response.ok) {
        throw new Error('Failed to update label');
      }

      const updatedLabel = await response.json();
      await mutate(labels?.map((l) => (l.id === id ? { ...l, ...updatedLabel } : l)) || [], false);
      toast.success('Label updated successfully');
      return updatedLabel;
    } catch (error) {
      toast.error('Failed to update label');
      throw error;
    }
  };

  const deleteLabel = async (id: string) => {
    try {
      const response = await fetch('/api/v1/labels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete label');
      }

      await mutate(labels?.filter((label) => label.id !== id) || [], false);
      toast.success('Label deleted successfully');
    } catch (error) {
      toast.error('Failed to delete label');
      throw error;
    }
  };

  const getThreadLabels = async (ids: string[]) => {
    const { data } = await useThreadLabels(ids);
    return data || [];
  };

  return {
    labels: labels || [],
    isLoading,
    error,
    createLabel,
    updateLabel,
    deleteLabel,
    getThreadLabels,
    refresh: () => mutate(),
  };
}

export function useThreadLabels(ids: string[]) {
  const key = ids.length > 0 ? `/api/v1/thread-labels?ids=${ids.join(',')}` : null;

  return useSWR<Label[]>(
    key,
    async (url) => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch thread labels');
        }

        return response.json();
      } catch (error) {
        toast.error('Failed to fetch thread labels');
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 5000,
    },
  );
}
