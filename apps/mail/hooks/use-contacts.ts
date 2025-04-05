'use client';

import { getAllContacts, type GoogleContact } from '@/actions/contacts';
import useSWR from 'swr';
import { useState, useEffect } from 'react';

export function useContacts() {
  const { data, error, isLoading, mutate } = useSWR<GoogleContact[]>(
    '/api/v1/mail/contacts',
    getAllContacts,
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // Cache for just 10 seconds to make sure we refresh quickly
      errorRetryCount: 3,
    }
  );
  
  const [needsContactsPermission, setNeedsContactsPermission] = useState(false);
  
  // Force refresh when component mounts
  useEffect(() => {
    mutate();
  }, [mutate]);
  
  useEffect(() => {
    // Check if we might be missing contacts permissions
    if (!isLoading && !error && (!data || data.length === 0)) {
      // If we got an empty response but no error, we might be missing permissions
      console.log("No contacts found - might need permissions");
      setNeedsContactsPermission(true);
    } else {
      setNeedsContactsPermission(false);
    }
    
    // Log current contacts state
    console.log("Contacts state:", {
      contactsCount: data?.length || 0,
      isLoading,
      hasError: !!error,
      needsPermission: !isLoading && !error && (!data || data.length === 0)
    });
  }, [data, error, isLoading]);

  return {
    contacts: data || [],
    error,
    isLoading,
    mutate,
    needsContactsPermission,
    refreshContacts: () => mutate(),
  };
}