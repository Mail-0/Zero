"use server";

import { auth as authService } from "@/lib/auth";
import { headers } from "next/headers";
import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";
import { cache } from "react";

import { GoogleContact } from "@/app/api/driver/types";

export const getGoogleContacts = cache(async (): Promise<{ contacts: GoogleContact[], status: 'success' | 'no_session' | 'error', message?: string }> => {
  try {
    const headersList = await headers();
    const session = await authService.api.getSession({ headers: headersList });

    if (!session?.user?.id || !session.activeConnection?.id) {
      console.log("No active session or connection");
      return { contacts: [], status: 'no_session', message: 'No active session or connection' };
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
      console.log("No refresh token found for connection");
      return { contacts: [], status: 'error', message: 'No refresh token found for connection' };
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
    console.log("Connection scope includes contacts:", hasContactsScope);
    
    // Only attempt to get contacts if we have the proper scope
    // or fall back to Gmail contacts if not
    if (!hasContactsScope) {
      console.log("Contacts scope not included, will use Gmail fallback method");
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
      console.log("Successfully fetched user info with scope:", userConnection.scope);

      // Get contacts directly from People API
      try {
        console.log("Attempting to fetch contacts via People API...");
        const peopleApi = await driver.getPeopleApi(userConnection.accessToken, userConnection.refreshToken);
        
        try {
          // First try to get user profile to check if token is working
          const userProfile = await peopleApi.people.get({
            resourceName: 'people/me',
            personFields: 'names,emailAddresses'
          });
          
          console.log("People API access confirmed:", 
            userProfile.data.emailAddresses?.[0]?.value || "No email found");
        } catch (profileError) {
          console.error("Failed to get user profile from People API:", profileError);
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
          console.log(`Retrieved ${pageConnections.length} contacts from page, total: ${connections.length}`);
          
          // Update pageToken for next iteration
          pageToken = response.data.nextPageToken;
        } while (pageToken);
        
        console.log(`Retrieved a total of ${connections.length} contacts from Google People API`);
        
        // Detailed logging to debug empty contacts issue
        if (connections.length === 0) {
          console.log("No connections returned from People API. This could be due to permission issues or no contacts available.");
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
        
        console.log(`Added ${contacts.length} contacts from People API`);
      } catch (peopleError) {
        console.error("Error fetching contacts from People API:", peopleError);
        console.log("Will try fallback method instead");
      }
    } catch (error) {
      console.log("Error fetching contacts:", error);
    }

    // If no contacts found from People API, or if we don't have contacts scope,
    // use the Gmail API to extract recipients
    if (contacts.length === 0 || !hasContactsScope) {
      try {
        console.log("Fallback: Using Gmail API to find contacts from message history...");
        
        // Use the driver's built-in method to get Gmail contacts
        const gmailContacts = await driver.getContactsFromGmail!(
          userConnection.accessToken, 
          userConnection.refreshToken, 
          userConnection.email || ''
        );
        
        // Create a set of existing emails to avoid duplicates
        const existingEmails = new Set(contacts.map(contact => contact.email.toLowerCase()));
        
        // Add only non-duplicate contacts from Gmail
        for (const contact of gmailContacts) {
          if (!existingEmails.has(contact.email.toLowerCase())) {
            contacts.push(contact);
            existingEmails.add(contact.email.toLowerCase());
          }
        }
        
        console.log(`Added ${gmailContacts.length} email addresses from message history, ${contacts.length} total unique contacts`);
      } catch (err) {
        console.error('Error getting contacts from Gmail:', err);
      }
    }

    return { contacts, status: 'success' };
  } catch (error) {
    console.error("Error fetching Google contacts:", error);
    return { contacts: [], status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
});

// Cache contacts with a 5-minute TTL to prevent stale data
// This is implemented using React's cache function but with a manual expiration approach
let contactsCache: { data: GoogleContact[], timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const getAllContacts = cache(async (): Promise<GoogleContact[]> => {
  try {
    // Check if we have a valid cache
    const now = Date.now();
    if (contactsCache && (now - contactsCache.timestamp) < CACHE_TTL_MS) {
      console.log(`Using cached contacts, age: ${Math.round((now - contactsCache.timestamp)/1000)}s`);
      return contactsCache.data;
    }
    
    // Cache expired or doesn't exist, fetch fresh data
    const result = await getGoogleContacts();
    
    // Add debugging logs
    console.log(`Fetched ${result.contacts.length} Google contacts for email suggestions (status: ${result.status})`);
    
    // Update cache
    contactsCache = {
      data: result.contacts,
      timestamp: now
    };
    
    return result.contacts;
  } catch (error) {
    console.error("Error fetching all contacts:", error);
    // Return cached data if available, even if expired
    if (contactsCache?.data) {
      console.log("Returning stale cached contacts due to error");
      return contactsCache.data;
    }
    return [];
  }
});