import useSWR from 'swr';

export type Deal = {
  id: string;
  name: string;
  stage: string;
  amount?: string;
  closeDate?: string;
  nextActivity?: string;
};

export type ContactContext = {
  contact: {
    id: number | string;
    name: string;
    jobTitle?: string;
    companyName?: string;
  } | null;
  deals: Deal[];
};

const fetcher = async (url: string): Promise<ContactContext> => {
  const apiBase = import.meta.env.VITE_PUBLIC_BACKEND_URL || 'http://localhost:8787';
  console.log('📨 Tag fetch →', `${apiBase}${url}`);
  const res = await fetch(`${apiBase}${url}`);
  if (!res.ok) throw new Error('Failed to fetch context');
  return res.json();
};

export function useContextTags(email?: string) {
  const { data, error, isLoading } = useSWR<ContactContext>(
    email ? `/api/context?email=${email}` : null,
    fetcher
  );

  return {
    tags: data?.contact
      ? [
          ...(data.contact.companyName ? [data.contact.companyName] : []),
          ...(data.deals?.map((d) => d.name).filter(Boolean) || [])
        ]
      : [],
    isLoading,
    error,
  };
}
