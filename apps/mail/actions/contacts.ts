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
  // Parse email addresses in format "Name <email@example.com>"
  const addressRegex = /(.*?)<(.+?)>/g;
  let match;
  
  while ((match = addressRegex.exec(headerValue)) !== null) {
    const name = match[1]?.trim() || '';
    const email = match[2]?.trim();
    
    if (email && !emailAddresses.has(email) && email.toLowerCase() !== userEmail) {
      emailAddresses.add(email);
      if (name) {
        emailNames.set(email, name);
      }
    }
  }
  
  // Also handle plain email addresses without names
  headerValue
    .split(',')
    .map(addr => addr.trim())
    .filter(addr => addr.includes('@') && !addr.includes('<') && 
           addr.toLowerCase() !== userEmail)
    .forEach(email => {
      emailAddresses.add(email);
    });
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
    const hasContactsScope = userConnection.scope?.includes("https://www.googleapis.com/auth/contacts.readonly");
    console.log("Connection scope includes contacts:", hasContactsScope);

    // First try to get contacts directly from the People API
    let contacts: GoogleContact[] = [];

    if (hasContactsScope) {
      try {
        const auth = {
          access_token: userConnection.accessToken,
          refresh_token: userConnection.refreshToken
        };

        // Get user info to test the connection
        const userInfo = await driver.getUserInfo(auth);
        console.log("Successfully fetched user info with scope:", userConnection.scope);

        // TODO: Implement a proper getContacts method on the driver
        // For now, we just return an empty array as we'll use the fallback
      } catch (error) {
        console.log("Error fetching contacts:", error);
      }
    } else {
      console.log("Missing contacts scope needed for direct API access.");
      console.log("User will need to click the 'Connect' button to grant contacts permission.");
    }

    // If no contacts found, use the Gmail API to extract recipients
    if (contacts.length === 0) {
      try {
        console.log("Fallback: Using Gmail API to find contacts from message history...");
        
        // Create Gmail API client from the driver
        const gmail = await driver.getGmailApi(userConnection.accessToken, userConnection.refreshToken);
        
        // Get a list of emails sent in the last 60 days
        const sentEmailsResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'in:sent newer_than:60d',
          maxResults: 50
        });
        
        const messageIds = sentEmailsResponse.data.messages?.map(msg => msg.id) || [];
        console.log(`Found ${messageIds.length} sent messages for contacts extraction`);
        
        // Extract recipients from these emails
        const emailAddresses = new Set<string>();
        const emailNames = new Map<string, string>();
        
        // Process up to 15 messages to extract recipients
        for (let i = 0; i < Math.min(15, messageIds.length); i++) {
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