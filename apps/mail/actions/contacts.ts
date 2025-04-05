"use server";

import { auth as authService } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";
import { db } from "@zero/db";
import { connection } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

export interface GoogleContact {
  id: string;
  name?: string;
  email: string;
  profilePhotoUrl?: string;
}

export const getGoogleContacts = cache(async (): Promise<GoogleContact[]> => {
  try {
    const headersList = await headers();
    const session = await authService.api.getSession({ headers: headersList });

    if (!session?.user?.id || !session.activeConnection?.id) {
      console.error("No active session or connection");
      return [];
    }

    // Get the active Google connection
    const [userConnection] = await db
      .select({
        id: connection.id,
        refreshToken: connection.refreshToken,
        scope: connection.scope,
      })
      .from(connection)
      .where(eq(connection.id, session.activeConnection.id))
      .limit(1);

    if (!userConnection?.refreshToken) {
      console.error("No refresh token found for connection");
      return [];
    }
    
    // Check if we have contacts scope
    const hasContactsScope = userConnection.scope?.includes("https://www.googleapis.com/auth/contacts.readonly");
    
    if (!hasContactsScope) {
      console.log("Missing contacts scope needed for email suggestions. Current scope:", userConnection.scope);
      console.log("User will need to click the 'Connect' button to grant contacts permission.");
      
      // Instead of returning empty, let's continue and try the Gmail history approach
      // This way we can still provide some suggestions even without contacts permission
      // We'll setup the auth and skip the contacts API calls
      const googleAuth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID as string,
        process.env.GOOGLE_CLIENT_SECRET as string,
        process.env.GOOGLE_REDIRECT_URI as string
      );
      
      googleAuth.setCredentials({
        refresh_token: userConnection.refreshToken,
        scope: userConnection.scope,
      });
      
      const contacts: GoogleContact[] = [];
      
      // Skip to the Gmail history approach
      try {
        console.log("Trying Gmail API to find common email addresses as fallback...");
        
        // Use Gmail API to search for emails sent from the user
        const gmail = google.gmail({ version: 'v1', auth: googleAuth });
        
        // Get a list of emails sent in the last 30 days
        const sentEmailsResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'in:sent newer_than:30d',
          maxResults: 50
        });
        
        const messageIds = sentEmailsResponse.data.messages?.map(msg => msg.id) || [];
        console.log(`Found ${messageIds.length} sent messages for autofill suggestions`);
        
        // Extract recipients from these emails
        const emailAddresses = new Set<string>();
        const emailNames = new Map<string, string>();
        
        // Process up to 10 messages to extract recipients
        for (let i = 0; i < Math.min(10, messageIds.length); i++) {
          try {
            const messageId = messageIds[i];
            if (!messageId) continue;
            
            const message = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'metadata',
              metadataHeaders: ['To', 'Cc', 'Bcc']
            });
            
            // Extract recipient information
            const headers = message.data.payload?.headers || [];
            
            // Process To, Cc, and Bcc headers
            for (const header of headers) {
              if (['To', 'Cc', 'Bcc'].includes(header.name || '') && header.value) {
                // Parse email addresses from header
                const addressRegex = /(.*?)<(.+?)>/g;
                let match;
                
                while ((match = addressRegex.exec(header.value)) !== null) {
                  const name = match[1]?.trim() || '';
                  const email = match[2]?.trim();
                  
                  if (email && !emailAddresses.has(email) && email.toLowerCase() !== userConnection.email?.toLowerCase()) {
                    emailAddresses.add(email);
                    if (name) {
                      emailNames.set(email, name);
                    }
                  }
                }
                
                // Also handle plain email addresses without names
                header.value
                  .split(',')
                  .map(addr => addr.trim())
                  .filter(addr => addr.includes('@') && !addr.includes('<') && 
                         addr.toLowerCase() !== userConnection.email?.toLowerCase())
                  .forEach(email => {
                    emailAddresses.add(email);
                  });
              }
            }
          } catch (err) {
            console.error('Error processing message:', err);
          }
        }
        
        // Add extracted email addresses to contacts
        let id = 0;
        emailAddresses.forEach(email => {
          contacts.push({
            id: `gmail-frequent-${id++}`,
            name: emailNames.get(email) || undefined,
            email,
            profilePhotoUrl: undefined
          });
        });
        
        console.log(`Added ${emailAddresses.size} email addresses from sent messages history as fallback`);
        return contacts;
      } catch (err) {
        console.error('Error getting frequent contacts from Gmail:', err);
        return [];
      }
    }

    // Set up the Google People API client
    const googleAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID as string,
      process.env.GOOGLE_CLIENT_SECRET as string,
      process.env.GOOGLE_REDIRECT_URI as string
    );

    googleAuth.setCredentials({
      refresh_token: userConnection.refreshToken,
      scope: [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    });

    const people = google.people({ version: "v1", auth: googleAuth });

    // Fetch contacts from Google People API
    console.log("Fetching contacts from Google People API...");
    const contacts: GoogleContact[] = [];
    
    try {
      const response = await people.people.connections.list({
        resourceName: "people/me",
        pageSize: 100,
        personFields: "names,emailAddresses,photos",
      });

      console.log("Google API response:", {
        totalItems: response.data.totalItems,
        totalPeople: response.data.totalPeople,
        hasConnections: !!response.data.connections,
        connectionsCount: response.data.connections?.length || 0
      });

      if (response.data.connections) {
        response.data.connections.forEach((person) => {
          if (person.emailAddresses && person.emailAddresses.length > 0) {
            const primaryEmail = person.emailAddresses[0].value;
            if (primaryEmail) {
              contacts.push({
                id: person.resourceName || "",
                name: person.names?.[0]?.displayName,
                email: primaryEmail,
                profilePhotoUrl: person.photos?.[0]?.url,
              });
            }
          }
        });
        console.log(`Processed ${contacts.length} contacts with email addresses`);
      } else {
        console.log("No connections found in the response");
      }
    } catch (error) {
      console.error("Error fetching contacts from Google People API connections:", error);
    }
    
    // If no contacts found or error occurred, try the otherContacts API
    if (contacts.length === 0) {
      try {
        console.log("Trying otherContacts API...");
        const otherContactsResponse = await people.otherContacts.list({
          pageSize: 100,
          readMask: "names,emailAddresses,photos",
        });
        
        console.log("otherContacts response:", {
          hasOtherContacts: !!otherContactsResponse.data.otherContacts,
          count: otherContactsResponse.data.otherContacts?.length || 0
        });
        
        if (otherContactsResponse.data.otherContacts) {
          otherContactsResponse.data.otherContacts.forEach((person) => {
            if (person.emailAddresses && person.emailAddresses.length > 0) {
              const primaryEmail = person.emailAddresses[0].value;
              if (primaryEmail) {
                contacts.push({
                  id: person.resourceName || "",
                  name: person.names?.[0]?.displayName || "",
                  email: primaryEmail,
                  profilePhotoUrl: person.photos?.[0]?.url,
                });
              }
            }
          });
          console.log(`Processed ${contacts.length} other contacts with email addresses`);
        }
      } catch (error) {
        console.error("Error fetching contacts from Google People API otherContacts:", error);
      }
    }
    
    // If all APIs failed to provide contacts, try one more fallback approach by using Gmail API 
    // to get frequently emailed addresses
    if (contacts.length === 0) {
      try {
        console.log("Trying Gmail API to find common email addresses...");
        
        // Use Gmail API to search for emails sent from the user
        const gmail = google.gmail({ version: 'v1', auth: googleAuth });
        
        // Get a list of emails sent in the last 30 days
        const sentEmailsResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'in:sent newer_than:30d',
          maxResults: 50
        });
        
        const messageIds = sentEmailsResponse.data.messages?.map(msg => msg.id) || [];
        console.log(`Found ${messageIds.length} sent messages`);
        
        // Extract recipients from these emails
        const emailAddresses = new Set<string>();
        const emailNames = new Map<string, string>();
        
        // Process up to 10 messages to extract recipients
        for (let i = 0; i < Math.min(10, messageIds.length); i++) {
          try {
            const messageId = messageIds[i];
            if (!messageId) continue;
            
            const message = await gmail.users.messages.get({
              userId: 'me',
              id: messageId,
              format: 'metadata',
              metadataHeaders: ['To', 'Cc', 'Bcc']
            });
            
            // Extract recipient information
            const headers = message.data.payload?.headers || [];
            
            // Process To, Cc, and Bcc headers
            for (const header of headers) {
              if (['To', 'Cc', 'Bcc'].includes(header.name || '') && header.value) {
                // Parse email addresses from header
                const addressRegex = /(.*?)<(.+?)>/g;
                let match;
                
                while ((match = addressRegex.exec(header.value)) !== null) {
                  const name = match[1]?.trim() || '';
                  const email = match[2]?.trim();
                  
                  if (email && !emailAddresses.has(email)) {
                    emailAddresses.add(email);
                    if (name) {
                      emailNames.set(email, name);
                    }
                  }
                }
                
                // Also handle plain email addresses without names
                header.value
                  .split(',')
                  .map(addr => addr.trim())
                  .filter(addr => addr.includes('@') && !addr.includes('<'))
                  .forEach(email => {
                    emailAddresses.add(email);
                  });
              }
            }
          } catch (err) {
            console.error('Error processing message:', err);
          }
        }
        
        // Add extracted email addresses to contacts, filtering out the user's own email
        let id = 0;
        const userEmail = userConnection?.email?.toLowerCase();
        
        emailAddresses.forEach(email => {
          // Skip the user's own email address
          if (email.toLowerCase() !== userEmail) {
            contacts.push({
              id: `gmail-frequent-${id++}`,
              name: emailNames.get(email) || undefined,
              email,
              profilePhotoUrl: undefined
            });
          }
        });
        
        console.log(`Added ${emailAddresses.size} email addresses from sent messages`);
      } catch (err) {
        console.error('Error getting frequent contacts from Gmail:', err);
      }
    }

    return contacts;
  } catch (error) {
    console.error("Error fetching Google contacts:", error);
    return [];
  }
});

export async function getAllContacts(): Promise<GoogleContact[]> {
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
}