"use server";

import { auth as authService } from "@/lib/auth";
import { headers } from "next/headers";
import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";
import { cache } from "react";
import { logger } from "@/lib/logger";

import { GoogleContact } from "@/app/api/driver/types";

/**
 * Cache contacts with TTLs to prevent stale data while maintaining performance
 * Use a Map with user IDs as keys to prevent cross-user cache sharing
 */
const contactsCache = new Map<string, { data: GoogleContact[], timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes for fresh cache
const EXTENDED_TTL_MS = 30 * 60 * 1000; // 30 minutes for stale-but-usable cache

/**
 * Gets all contacts for the current user with efficient caching
 */
export const getAllContacts = cache(async (): Promise<GoogleContact[]> => {
  try {
    // Get user info to use as cache key
    const headersList = await headers();
    const session = await authService.api.getSession({ headers: headersList });
    const userId = session?.user?.id || 'anonymous';
    
    // Check if we have a valid cache
    const now = Date.now();
    const userCache = contactsCache.get(userId);
    
    // If cache is fresh, use it immediately
    if (userCache && (now - userCache.timestamp) < CACHE_TTL_MS) {
      logger.debug(`Using cached contacts for user ${userId}, age: ${Math.round((now - userCache.timestamp)/1000)}s`);
      return userCache.data;
    }
    
    // If cache is expired, but not too old, trigger a refresh
    // but return the cached data immediately to improve perceived performance
    if (userCache && (now - userCache.timestamp) < EXTENDED_TTL_MS) {
      logger.info(`Cache expired but not stale for user ${userId}, refreshing in background`);
      
      // Refresh cache in background
      Promise.resolve().then(async () => {
        try {
          const freshContacts = await fetchGoogleContacts();
          contactsCache.set(userId, {
            data: freshContacts,
            timestamp: Date.now()
          });
          logger.info(`Background cache refresh complete for user ${userId}, fetched ${freshContacts.length} contacts`);
        } catch (error) {
          logger.error("Background cache refresh failed:", error);
        }
      });
      
      return userCache.data;
    }
    
    // Cache is completely stale or doesn't exist, fetch fresh data
    const contacts = await fetchGoogleContacts();
    
    // Add debugging logs
    logger.info(`Fetched ${contacts.length} Google contacts for user ${userId}`);
    
    // Update cache
    contactsCache.set(userId, {
      data: contacts,
      timestamp: now
    });
    
    return contacts;
  } catch (error) {
    logger.error("Error fetching all contacts:", error);
    
    // Try to get user ID for cache lookup
    try {
      const headersList = await headers();
      const session = await authService.api.getSession({ headers: headersList });
      const userId = session?.user?.id || 'anonymous';
      const userCache = contactsCache.get(userId);
      
      // Return cached data if available, even if expired
      if (userCache?.data) {
        logger.info(`Returning stale cached contacts for user ${userId} due to error`);
        return userCache.data;
      }
    } catch (e) {
      logger.error("Failed to retrieve user session for cache fallback:", e);
    }
    
    return [];
  }
});

/**
 * Fetch Google contacts directly from Google APIs via the driver
 * This function has been moved from its own export to be directly used by getAllContacts
 */
async function fetchGoogleContacts(): Promise<GoogleContact[]> {
  try {
    const headersList = await headers();
    const session = await authService.api.getSession({ headers: headersList });

    if (!session?.user?.id || !session.activeConnection?.id) {
      logger.info("No active session or connection");
      return [];
    }

    // Get the active Google connection details
    const [userConnection] = await db
      .select({
        id: connection.id,
        email: connection.email,
        refreshToken: connection.refreshToken,
        accessToken: connection.accessToken,
        scope: connection.scope,
      })
      .from(connection)
      .where(eq(connection.id, session.activeConnection.id))
      .limit(1);

    if (!userConnection?.refreshToken) {
      logger.info("No refresh token found for connection");
      return [];
    }

    // Create the driver with the existing tokens
    const driver = await createDriver("google", {
      auth: {
        access_token: userConnection.accessToken,
        refresh_token: userConnection.refreshToken
      }
    });

    // Check if we have proper permissions and log
    // Check for both contacts scopes - the old readonly scope and the newer contacts scope
    const hasContactsScope = userConnection.scope?.includes("https://www.googleapis.com/auth/contacts.readonly") || 
                            userConnection.scope?.includes("https://www.googleapis.com/auth/contacts");
    logger.debug("Connection scope includes contacts:", hasContactsScope);
    
    // Only attempt to get contacts if we have the proper scope
    // or fall back to Gmail contacts if not
    if (!hasContactsScope) {
      logger.info("Contacts scope not included, will use Gmail fallback method");
    }

    // First try to get contacts directly from the People API
    let contacts: GoogleContact[] = [];

    // Always try to fetch contacts, even if scope doesn't explicitly include it
    try {
      const auth = {
        access_token: userConnection.accessToken,
        refresh_token: userConnection.refreshToken
      };

      // Get user info to test the connection
      const userInfo = await driver.getUserInfo(auth);
      logger.debug("Successfully fetched user info with scope:", userConnection.scope);

      // Get contacts directly from provider's contacts API
      try {
        logger.info("Attempting to fetch contacts via provider's contacts API...");
        const peopleApi = await driver.getContactsAPIClient(userConnection.accessToken, userConnection.refreshToken);
        
        try {
          // First try to get user profile to check if token is working
          const userProfile = await peopleApi.people.get({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses'
          });
          
          logger.info("People API access confirmed:", 
            userProfile.data.emailAddresses?.[0]?.value || "No email found");
        } catch (profileError) {
          logger.error("Failed to get user profile from People API:", profileError);
          // Try one more time with exponential backoff for transient errors
          if (profileError.code === 429 || (profileError.code && profileError.code >= 500)) {
            logger.info("Attempting retry after timeout...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
              const retryProfile = await peopleApi.people.get({
                resourceName: 'people/me',
                personFields: 'names,emailAddresses'
              });
              logger.info("People API access confirmed on retry:", 
                retryProfile.data.emailAddresses?.[0]?.value || "No email found");
            } catch (retryError) {
              logger.error("Retry also failed:", retryError);
            }
          }
          // Continue anyway, we might still be able to get connections
        }
        
        // Now try to get contacts with pagination support
        let pageToken = undefined;
        const connections: any[] = [];
        
        do {
          const response = await peopleApi.people.connections.list({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses,photos',
            pageSize: 100,
            pageToken
          });
          
          const pageConnections = response.data.connections || [];
          connections.push(...pageConnections);
          logger.debug(`Retrieved ${pageConnections.length} contacts from page, total: ${connections.length}`);
          
          // Update pageToken for next iteration
          pageToken = response.data.nextPageToken;
        } while (pageToken);
        
        logger.info(`Retrieved a total of ${connections.length} contacts from Google People API`);
        
        // Detailed logging to debug empty contacts issue
        if (connections.length === 0) {
          logger.warn("No connections returned from People API. This could be due to permission issues or no contacts available.");
        }
        
        connections.forEach(person => {
          const email = person.emailAddresses?.[0]?.value;
          if (email && email.toLowerCase() !== userConnection.email?.toLowerCase()) {
            // Check if contact with this email already exists before adding
            if (!contacts.some(c => c.email.toLowerCase() === email.toLowerCase())) {
              contacts.push({
                id: person.resourceName || `people-${contacts.length}`,
                name: person.names?.[0]?.displayName,
                email: email,
                profilePhotoUrl: person.photos?.[0]?.url
              });
            }
          }
        });
        
        logger.info(`Added ${contacts.length} contacts from People API`);
      } catch (peopleError) {
        logger.error("Error fetching contacts from People API:", peopleError);
        logger.info("Will try fallback method instead");
      }
    } catch (error) {
      logger.error("Error fetching contacts:", error);
    }

    // If no contacts found from People API, or if we don't have contacts scope,
    // use the Gmail API to extract recipients
    if (contacts.length === 0 || !hasContactsScope) {
      try {
        logger.info("Fallback: Using Gmail API to find contacts from message history...");
        
        // Use the driver's built-in method to get contacts from email history
        const emailContacts = await driver.getContacts!(
          userConnection.accessToken, 
          userConnection.refreshToken, 
          userConnection.email || ''
        );
        
        // Create a set of existing emails to avoid duplicates
        const existingEmails = new Set(contacts.map(contact => contact.email.toLowerCase()));
        
        // Add only non-duplicate contacts from email history
        for (const contact of emailContacts) {
          if (!existingEmails.has(contact.email.toLowerCase())) {
            contacts.push(contact);
            existingEmails.add(contact.email.toLowerCase());
          }
        }
        
        logger.info(`Added ${emailContacts.length} email addresses from message history, ${contacts.length} total unique contacts`);
      } catch (err) {
        logger.error('Error getting contacts from email history:', err);
      }
    }

    return contacts;
  } catch (error) {
    logger.error("Error fetching Google contacts:", error);
    return [];
  }
}