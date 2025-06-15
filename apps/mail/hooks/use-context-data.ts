import useSWR from 'swr';

export type Deal = {
  id: string;
  name: string;
  stage: string;
  amount?: string;
  closeDate?: string;
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
    const fullUrl = `http://localhost:8787${url}`;
    console.log('🔍 Fetching from', fullUrl);
    const res = await fetch(fullUrl);
    if (!res.ok) throw new Error('Failed to fetch context');
    return res.json();
  };  

export function useContextData(email?: string) {
  const { data, error, isLoading } = useSWR<ContactContext>(
    email ? `/api/context?email=${email}` : null,
    fetcher
  );

  return { data, error, isLoading };
}
