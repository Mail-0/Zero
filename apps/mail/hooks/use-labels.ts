import { useSession } from '@/lib/auth-client';
import { useMemo } from 'react';
import axios from 'axios';
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

const fetcher = async () => {
  const response = await axios.get('/api/v1/labels');
  return response.data;
};

export function useLabels() {
  const { data: session } = useSession();
  const {
    data: labels,
    error,
    isLoading,
    mutate,
  } = useSWR<Label[]>(session ? [session?.connectionId, 'user-labels'] : null, fetcher);

  return {
    mutate,
    labels: labels || [],
    isLoading,
    error,
  };
}

export function useThreadLabels(ids: string[]) {
  const { labels } = useLabels();

  const threadLabels = useMemo(() => {
    if (!labels) return [];
    return labels.filter((label) => (label.id ? ids.includes(label.id) : false));
  }, [labels, ids]);

  return { labels: threadLabels };
}

const createLabel = async (label: Omit<Label, 'id' | 'type'>) => {
  try {
    const response = await axios.post<Label>('/api/v1/labels', label);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const updateLabel = async (id: string, label: Partial<Omit<Label, 'id' | 'type'>>) => {
  try {
    const response = await axios.patch<Label>('/api/v1/labels', { id, ...label });
    return response.data;
  } catch (error) {
    throw error;
  }
};

const deleteLabel = async (id: string) => {
  try {
    await axios.delete<Label>('/api/v1/labels', { data: { id } });
  } catch (error) {
    throw error;
  }
};

export { createLabel, updateLabel, deleteLabel };
