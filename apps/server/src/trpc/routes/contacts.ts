import { activeDriverProcedure, router } from '../trpc';
import { z } from 'zod';
import { redis } from '../../lib/services';
import type { MailManager } from '../../lib/driver/types';
import { connectionToDriver } from '../../lib/server-utils';

interface ContactInfo {
  email: string;
  name: string | null;
  frequency: number;
  lastUsed: Date | null;
  source: 'sent' | 'received' | 'both';
  picture?: string | null;
}

interface CachedContactData {
  contacts: ContactInfo[];
  timestamp: number;
  userEmail: string;
}

const CACHE_DURATION = 5 * 60; // 5 minutes in seconds (Redis TTL format)
const MAX_THREADS_PER_FOLDER = 20;
const MAX_CONTACTS_TO_PROCESS = 100; 
const CACHE_KEY_PREFIX = 'contacts';

// Utility functions for Redis operations
const getCacheKey = (userEmail: string) => `${CACHE_KEY_PREFIX}:${userEmail}`;

const serializeContactData = (data: CachedContactData): string => {
  return JSON.stringify({
    ...data,
    contacts: data.contacts.map(contact => ({
      ...contact,
      lastUsed: contact.lastUsed?.toISOString() || null,
    }))
  });
};

const deserializeContactData = (data: string): CachedContactData | null => {
  try {
    const parsed = JSON.parse(data);
    
    // Validate the parsed structure
    if (!parsed || typeof parsed !== 'object') {
      console.error('Deserialized contact data is not an object');
      return null;
    }
    
    // Check if required properties exist
    if (!Array.isArray(parsed.contacts)) {
      console.error('Deserialized contact data does not have valid contacts array');
      return null;
    }
    
    if (!parsed.timestamp || typeof parsed.timestamp !== 'number') {
      console.error('Deserialized contact data does not have valid timestamp');
      return null;
    }
    
    if (!parsed.userEmail || typeof parsed.userEmail !== 'string') {
      console.error('Deserialized contact data does not have valid userEmail');
      return null;
    }
    
    return {
      ...parsed,
      contacts: parsed.contacts.map((contact: any) => ({
        ...contact,
        lastUsed: contact.lastUsed ? new Date(contact.lastUsed) : null,
      }))
    };
  } catch (error) {
    console.error('Failed to deserialize contact data:', error);
    return null;
  }
};

export const contactsRouter = router({
  search: activeDriverProcedure
    .input(
      z.object({
        query: z.string().optional().default(''),
        limit: z.number().optional().default(10),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { activeConnection } = ctx;
      const driver = connectionToDriver(activeConnection);
      const { query, limit } = input;

      try {
        const cache = redis();
        const cacheKey = getCacheKey(activeConnection.email);
        
        let allContacts: ContactInfo[];
        
        // Try to get cached data from Redis
        const cachedData = await cache.get(cacheKey);
        
        if (cachedData && typeof cachedData === 'string') {
          const parsedData = deserializeContactData(cachedData);
          if (parsedData) {
            allContacts = parsedData.contacts;
          } else {
            // Cache data is corrupted, fetch fresh data
            // Fetch only what we need rather than multiplying by 3
            const fetchLimit = Math.min(limit + 10, 30); // Add a small buffer but cap at a reasonable maximum
            allContacts = await getRecentContacts(
              driver,
              activeConnection.email,
              '',
              fetchLimit
            );
            await cacheContactData(cache, cacheKey, allContacts, activeConnection.email);
          }
        } else {
          // Get contacts from recent emails
          // Fetch more than requested to allow for filtering but be reasonable
          const fetchLimit = Math.min(limit + 10, 30); // Add a small buffer but cap at a reasonable maximum
          allContacts = await getRecentContacts(
            driver,
            activeConnection.email,
            '',
            fetchLimit
          );
          
          // Cache the results in Redis with TTL
          await cacheContactData(cache, cacheKey, allContacts, activeConnection.email);
        }

        // Filter contacts by query if provided
        let filteredContacts = allContacts;
        if (query) {
          const lowerQuery = query.toLowerCase();
          filteredContacts = allContacts.filter(contact => 
            contact.email.toLowerCase().includes(lowerQuery) || 
            (contact.name && contact.name.toLowerCase().includes(lowerQuery))
          );
        }
        
        // Sort by frequency/relevance and limit results
        const contacts = filteredContacts
          .sort((a, b) => {
            // Sort by frequency first, then by last used date
            if (b.frequency !== a.frequency) {
              return b.frequency - a.frequency;
            }
            if (a.lastUsed && b.lastUsed) {
              return b.lastUsed.getTime() - a.lastUsed.getTime();
            }
            return 0;
          })
          .slice(0, limit);
        
        return contacts;
      } catch (error) {
        console.error('Error searching contacts:', error);
        return [];
      }
    }),

  recent: activeDriverProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { activeConnection } = ctx;
      const driver = connectionToDriver(activeConnection);
      const { limit } = input;

      try {
        const cache = redis();
        const cacheKey = getCacheKey(activeConnection.email);
        
        // Try to get cached data from Redis
        const cachedData = await cache.get(cacheKey);
        
        if (cachedData && typeof cachedData === 'string') {
          const parsedData = deserializeContactData(cachedData);
          if (parsedData) {
            const result = parsedData.contacts.slice(0, limit);
            return result;
          }
        }
        
        // Fetch fresh data and cache it
        const contacts = await getRecentContacts(driver, activeConnection.email, '', limit);
        await cacheContactData(cache, cacheKey, contacts, activeConnection.email);
        
        return contacts;
      } catch (error) {
        console.error('Error fetching recent contacts:', error);
        return [];
      }
    }),

  // New endpoint to clear cache (useful for development/debugging)
  clearCache: activeDriverProcedure
    .mutation(async ({ ctx }) => {
      try {
        const cache = redis();
        const cacheKey = getCacheKey(ctx.activeConnection.email);
        await cache.del(cacheKey);
        return { success: true };
      } catch (error) {
        console.error('Error clearing contacts cache:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }),
});

// Helper function to cache contact data in Redis
async function cacheContactData(
  cache: ReturnType<typeof redis>,
  cacheKey: string,
  contacts: ContactInfo[],
  userEmail: string
): Promise<void> {
  try {
    const cacheData: CachedContactData = {
      contacts,
      timestamp: Date.now(),
      userEmail
    };
    
    const serializedData = serializeContactData(cacheData);
    await cache.set(cacheKey, serializedData, { ex: CACHE_DURATION });
  } catch (error) {
    console.error('Failed to cache contact data:', error);
  }
}

async function getRecentContacts(
  driver: MailManager,
  userEmail: string,
  query: string,
  limit: number,
): Promise<ContactInfo[]> {
  try {
    const contactMap = new Map<string, ContactInfo>();
    
    // Process sent and inbox threads in parallel with reduced thread counts
    const [sentThreads, inboxThreads] = await Promise.all([
      driver.list({
        folder: 'sent',
        maxResults: MAX_THREADS_PER_FOLDER,
      }).catch(() => ({ threads: [] })),
      driver.list({
        folder: 'inbox',
        maxResults: MAX_THREADS_PER_FOLDER,
      }).catch(() => ({ threads: [] }))
    ]);

    // Process threads in batches to avoid overwhelming the API
    const batchSize = 5;
    let processedContacts = 0;

    // Process sent emails in batches
    if (sentThreads?.threads) {
      for (let i = 0; i < sentThreads.threads.length; i += batchSize) {
        if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
        
        const batch = sentThreads.threads.slice(i, i + batchSize);
        const threadPromises = batch.map(async (thread: any) => {
          try {
            return await driver.get(thread.id);
          } catch (error) {
            console.warn(`Failed to fetch thread ${thread.id}:`, error);
            return null;
          }
        });
        
        const threadResults = await Promise.all(threadPromises);
        
        for (const threadData of threadResults) {
          if (!threadData?.messages) continue;
          
          for (const message of threadData.messages) {
            // Add TO recipients
            message.to?.forEach((recipient: any) => {
              if (recipient.email && recipient.email.toLowerCase() !== userEmail.toLowerCase()) {
                updateContactMap(contactMap, recipient.email, recipient.name, 'sent', new Date(message.receivedOn));
                processedContacts++;
              }
            });
            // Add CC recipients
            message.cc?.forEach((recipient: any) => {
              if (recipient.email && recipient.email.toLowerCase() !== userEmail.toLowerCase()) {
                updateContactMap(contactMap, recipient.email, recipient.name, 'sent', new Date(message.receivedOn));
                processedContacts++;
              }
            });
            
            if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
          }
          if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
        }
      }
    }

    // Process received emails in batches
    if (inboxThreads?.threads && processedContacts < MAX_CONTACTS_TO_PROCESS) {
      for (let i = 0; i < inboxThreads.threads.length; i += batchSize) {
        if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
        
        const batch = inboxThreads.threads.slice(i, i + batchSize);
        const threadPromises = batch.map(async (thread: any) => {
          try {
            return await driver.get(thread.id);
          } catch (error) {
            console.warn(`Failed to fetch thread ${thread.id}:`, error);
            return null;
          }
        });
        
        const threadResults = await Promise.all(threadPromises);
        
        for (const threadData of threadResults) {
          if (!threadData?.messages) continue;
          
          for (const message of threadData.messages) {
            if (message.sender?.email && message.sender.email.toLowerCase() !== userEmail.toLowerCase()) {
              updateContactMap(contactMap, message.sender.email, message.sender.name, 'received', new Date(message.receivedOn));
              processedContacts++;
              
              if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
            }
          }
          if (processedContacts >= MAX_CONTACTS_TO_PROCESS) break;
        }
      }
    }

    return Array.from(contactMap.values()).slice(0, limit);
  } catch (error) {
    console.error('Error in getRecentContacts:', error);
    return [];
  }
}

function updateContactMap(
  contactMap: Map<string, ContactInfo>,
  email: string,
  name: string | null | undefined,
  source: 'sent' | 'received',
  date: Date | undefined,
) {
  const key = email.toLowerCase();
  const existing = contactMap.get(key);
  
  if (existing) {
    existing.frequency += 1;
    if (date && (!existing.lastUsed || date > existing.lastUsed)) {
      existing.lastUsed = date;
    }
    if (existing.source !== source) {
      existing.source = 'both';
    }
    // Update name if we have a better one
    if (!existing.name && name) {
      existing.name = name;
    }
  } else {
    contactMap.set(key, {
      email,
      name: name || null,
      frequency: 1,
      lastUsed: date || null,
      source,
    });
  }
}