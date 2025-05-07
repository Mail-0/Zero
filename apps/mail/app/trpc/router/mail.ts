import { z } from 'zod';
import { procedure, router } from '@/app/trpc/trpc';
import { getActiveDriver } from '@/actions/utils';
import { bulkDeleteThread } from '@/actions/mail';
import type { InitialThread } from '@/types';

// Define interface for the response type
interface SpamFolderResponse {
  threads: InitialThread[];
  nextPageToken?: string;
}

// Function to get all spam emails with pagination
async function getAllSpamEmails(driver: any) {
  const allThreads: InitialThread[] = [];
  let pageToken: string | undefined = undefined;
  
  do {
    // Request a large batch size to minimize the number of API calls
    const response: SpamFolderResponse = await driver.list(
      'spam',       // folder
      undefined,    // query
      500,          // maxResults - Maximum allowed by Gmail API
      undefined,    // labelIds
      pageToken     // pageToken
    );
    
    if (response.threads && response.threads.length > 0) {
      allThreads.push(...response.threads);
    }
    
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  return { threads: allThreads };
}

export const mailRouter = router({
  deleteAllSpam: procedure
    .mutation(async () => {
      try {
        const driver = await getActiveDriver();
        
        // Get ALL emails from spam folder using pagination
        const spamEmails = await getAllSpamEmails(driver);

        if (!spamEmails?.threads?.length) {
          return { 
            success: true, 
            message: 'No spam emails to delete' 
          };
        }
        
        // Extract all email IDs
        const emailIds = spamEmails.threads.map((thread) => thread.id);
        
        // Move them to trash
        await bulkDeleteThread({ ids: emailIds });
        
        return { 
          success: true, 
          message: `Successfully deleted ${emailIds.length} email(s) from spam folder` 
        };
      } catch (error) {
        console.error('Error deleting all spam emails:', error);
        throw error;
      }
    }),
    
  // Add a separate procedure to check if spam folder has emails
  checkSpamEmails: procedure
    .query(async () => {
      try {
        const driver = await getActiveDriver();
        const spamEmails = await driver.list('spam');
        
        return { 
          hasEmails: !!spamEmails?.threads?.length,
          count: spamEmails?.threads?.length || 0
        };
      } catch (error) {
        console.error('Error checking spam emails:', error);
        return { hasEmails: false, count: 0 };
      }
    }),
});
