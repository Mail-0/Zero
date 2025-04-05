'use client';

import { getUserContacts } from '@/actions/user';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const TestPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getUserContacts();
      console.log('Contacts:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">TestPage</h1>
      <Button onClick={handleGetContacts} disabled={loading}>
        {loading ? 'Loading...' : 'Get User Contacts'}
      </Button>
      {error && <p className="mt-2 text-red-500">{error}</p>}
    </div>
  );
};

export default TestPage;
