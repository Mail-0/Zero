"use server";

import { auth as authService } from "@/lib/auth";
import { headers } from "next/headers";
import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";
import { cache } from "react";

export interface GoogleContact {
  id: string;
  name?: string;
  email: string;
  profilePhotoUrl?: string;
}

/**
 * Helper function to extract email addresses from header values
 * @param headerValue The raw header value containing email addresses
 * @param emailAddresses Set to store unique email addresses
 * @param emailNames Map to store name associations with emails
 * @param userEmail Optional user email to exclude from results
 */
function extractEmailAddresses(
  headerValue: string,
  emailAddresses: Set<string>,
  emailNames: Map<string, string>,
  userEmail?: string
) {
  if (!headerValue) return;
  
  // Normalize newlines and extra spaces
  const normalizedValue = headerValue.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
  
  // Parse email addresses in format "Name <email@example.com>"
  const addressRegex = /(.*?)<([^>]+)>/g;
  let match;
  
  // Track if we found any bracketed emails
  let foundBracketedEmail = false;
  
  while ((match = addressRegex.exec(normalizedValue)) !== null) {
    foundBracketedEmail = true;
    const name = match[1]?.trim() || '';
    const email = match[2]?.trim();
    
    if (email && !emailAddresses.has(email) && email.toLowerCase() !== userEmail?.toLowerCase()) {
      // Validate email using more comprehensive regex pattern
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (emailRegex.test(email)) {
        emailAddresses.add(email);
        if (name) {
          emailNames.set(email, name);
        }
      }
    }
  }
  
  // If we didn't find any bracketed emails, try to extract plain emails
  if (!foundBracketedEmail) {
    // More comprehensive email regex for extraction
    const emailRegex = /([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)/gi;
    let emailMatch;
    
    while ((emailMatch = emailRegex.exec(normalizedValue)) !== null) {
      const email = emailMatch[0].trim();
      if (email && !emailAddresses.has(email) && email.toLowerCase() !== userEmail?.toLowerCase()) {
        emailAddresses.add(email);
      }
    }
    
    // Also handle plain email addresses without names
    normalizedValue
      .split(/[,;]/)
      .map(addr => addr.trim())
      .filter(addr => addr.includes('@') && !addr.includes('<') && 
             addr.toLowerCase() !== userEmail?.toLowerCase())
      .forEach(email => {
        // Use the same comprehensive regex pattern for validation
        if (emailRegex.test(email)) {
          emailAddresses.add(email);
        }
      });
  }
}

export const getGoogleContacts = cache(async (): Promise<GoogleContact[]> => {
  try {
    const headersList = await headers();
    const session = await authService.api.getSession({ headers: headersList });

    if (!session?.user?.id || !session.activeConnection?.id) {
      console.log("No active session or connection");
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
      console.log("No refresh token found for connection");
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
    // We'll always attempt to get contacts regardless of scope, as Google may still allow access
    // based on previously granted permissions
    // Check for both contacts scopes - the old readonly scope and the newer contacts scope
    const hasContactsScope = userConnection.scope?.includes("https://www.googleapis.com/auth/contacts.readonly") || 
                            userConnection.scope?.includes("https://www.googleapis.com/auth/contacts");
    console.log("Connection scope includes contacts:", hasContactsScope);
    // Even if scope doesn't explicitly include contacts, we'll try anyway

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
        
        // Now try to get contacts
        const response = await peopleApi.people.connections.list({
          resourceName: 'people/me',
          personFields: 'names,emailAddresses,photos',
          pageSize: 100
        });
        
        const connections = response.data.connections || [];
        console.log(`Retrieved ${connections.length} contacts from Google People API`);
        
        // Detailed logging to debug empty contacts issue
        if (connections.length === 0) {
          console.log("No connections returned from People API. Response totalItems:", 
            response.data.totalItems, "totalPeople:", response.data.totalPeople);
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

    // If no contacts found, use the Gmail API to extract recipients
    if (contacts.length === 0) {
      try {
        console.log("Fallback: Using Gmail API to find contacts from message history...");
        
        // Create Gmail API client from the driver
        const gmail = await driver.getGmailApi(userConnection.accessToken, userConnection.refreshToken);
        
        // Get a list of emails sent in the last 60 days with pagination support
        const allMessageIds: string[] = [];
        let pageToken = undefined;
        
        // Implement pagination to get more complete results
        do {
          const sentEmailsResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'in:sent newer_than:60d',
            maxResults: 100,
            pageToken: pageToken
          });
          
          if (sentEmailsResponse.data.messages) {
            sentEmailsResponse.data.messages.forEach(msg => {
              if (msg.id) allMessageIds.push(msg.id);
            });
          }
          
          pageToken = sentEmailsResponse.data.nextPageToken;
          // Limit to 200 total messages for performance reasons
          if (allMessageIds.length >= 200) break;
        } while (pageToken);
        
        console.log(`Found ${allMessageIds.length} sent messages for contacts extraction`);
        
        // Extract recipients from these emails
        const emailAddresses = new Set<string>();
        const emailNames = new Map<string, string>();
        
        // Get contacts from more sources for better fallback

        // Process both sent and received messages for maximum contact extraction
        console.log("Expanding search to include both sent and inbox messages for better contact discovery");
        
        // Get inbox messages too for a better contact list, with pagination
        let inboxIds: string[] = [];
        pageToken = undefined;
        
        do {
          const inboxResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'in:inbox',
            maxResults: 50,
            pageToken: pageToken
          });
          
          if (inboxResponse.data.messages) {
            inboxResponse.data.messages.forEach(msg => {
              if (msg.id) inboxIds.push(msg.id);
            });
          }
          
          pageToken = inboxResponse.data.nextPageToken;
          // Limit to 100 inbox messages for performance
          if (inboxIds.length >= 100) break;
        } while (pageToken);
        
        console.log(`Found ${inboxIds.length} inbox messages for contacts extraction`);
        
        // Combine sent and inbox messages for processing
        const combinedMessageIds = [...allMessageIds, ...inboxIds];
        const uniqueMessageIds = Array.from(new Set(combinedMessageIds));
        console.log(`Processing ${uniqueMessageIds.length} unique messages for contacts`);
        
        // Process messages to extract recipients and senders with controlled concurrency
        const processedCount = Math.min(75, uniqueMessageIds.length);
        const batchSize = 10; // Process 10 messages concurrently
        
        for (let i = 0; i < processedCount; i += batchSize) {          
          // Create a batch of promises to process messages concurrently
          const batch = uniqueMessageIds.slice(i, i + batchSize).map(async messageId => {
            if (!messageId) return;
            
            try {
              const message = await gmail.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'metadata',
                metadataHeaders: ['To', 'Cc', 'Bcc', 'From', 'Reply-To']
              });
              
              // Extract recipient information
              const headers = message.data.payload?.headers || [];
              
              // Process all relevant headers
              for (const header of headers) {
                if (['To', 'Cc', 'Bcc', 'From', 'Reply-To'].includes(header.name || '') && header.value) {
                  extractEmailAddresses(
                    header.value, 
                    emailAddresses, 
                    emailNames, 
                    userConnection.email?.toLowerCase()
                  );
                }
              }
            } catch (err) {
              console.error('Error processing message:', err);
            }
          });
          
          // Wait for the current batch to complete before processing the next batch
          await Promise.all(batch);
        }
        
        // Add extracted email addresses to contacts
        let id = 0;
        emailAddresses.forEach(email => {
          contacts.push({
            id: `gmail-history-${id++}`,
            name: emailNames.get(email) || undefined,
            email,
            profilePhotoUrl: undefined
          });
        });
        
        console.log(`Added ${emailAddresses.size} email addresses from message history`);
      } catch (err) {
        console.error('Error getting contacts from Gmail:', err);
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error fetching Google contacts (this might be normal if you're not logged in):", error);
    return [];
  }
});

// Cache contacts with a short TTL to improve performance
export const getAllContacts = cache(async (): Promise<GoogleContact[]> => {
  try {
    // Fetch Google contacts
    const googleContacts = await getGoogleContacts();
    
    // Add debugging logs
    console.log(`Fetched ${googleContacts.length} Google contacts for email suggestions`);
    
    return googleContacts;
  } catch (error) {
    console.error("Error fetching all contacts (this might be normal if you're not logged in):", error);
    return [];
  }
});