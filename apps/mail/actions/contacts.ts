"use server";

import { auth as authService } from "@/lib/auth";
import { headers } from "next/headers";
import { createDriver } from "@/app/api/driver";
import { connection } from "@zero/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@zero/db";
import { cache } from "react";

import { GoogleContact } from "@/app/api/driver/types";

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
        
        // Use the driver's built-in method to get Gmail contacts
        const gmailContacts = await driver.getContactsFromGmail!(
          userConnection.accessToken, 
          userConnection.refreshToken, 
          userConnection.email || ''
        );
        
        // Add the extracted contacts to our contacts list
        contacts.push(...gmailContacts);
        
        console.log(`Added ${gmailContacts.length} email addresses from message history`);
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