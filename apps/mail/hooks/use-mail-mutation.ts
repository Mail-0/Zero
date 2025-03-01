"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useSession } from "@/lib/auth-client";
import { updateLabels, updateThreadLabels, batchUpdateLabels } from "@/actions/mail";

export type FolderType = 'inbox' | 'archive' | 'spam' | 'sent' | 'trash' | string;

interface UseMailMutationOptions {
  closeSelected?: boolean;
}

export function useMailMutation(
  currentFolder: FolderType,
  options: UseMailMutationOptions = { closeSelected: true }
) {
  const { mutate } = useSWRConfig();
  const { data: session } = useSession();
  
  const isThreadId = useCallback((id: string) => {
    return id.startsWith('thread:');
  }, []);
  
  const updateEmailLabels = useCallback(async (
    emailId: string, 
    labelsToAdd: string[] = [], 
    labelsToRemove: string[] = []
  ) => {
    if (!session?.user.id || !session.connectionId) {
      console.error("No session or connection ID found");
      return false;
    }
    
    try {
      if (isThreadId(emailId)) {
        console.log(`Detected thread ID: ${emailId}, using thread-level operation`);
        const result = await updateThreadLabels({
          threadId: emailId,
          addLabels: labelsToAdd,
          removeLabels: labelsToRemove,
        });
        
        return result.success;
      } else {
        console.log(`Using single message operation for ID: ${emailId}`);
        const result = await updateLabels({
          emailId,
          addLabels: labelsToAdd,
          removeLabels: labelsToRemove,
        });
        
        return result.success;
      }
    } catch (error) {
      console.error("Error updating email/thread labels:", error);
      return false;
    }
  }, [session, isThreadId]);
  
  const removeEmailsFromCache = useCallback((folder: FolderType, emailIds: string[]) => {
    mutate(
      (key) => {
        if (Array.isArray(key) && key.length > 0) {
          const [userId, folderName] = key;
          return folderName === folder && userId === session?.user.id;
        }
        return false;
      },
      (cachedData: any) => {
        if (!cachedData || !cachedData.threads) {
          return cachedData;
        }
        
        const updatedThreads = cachedData.threads.filter(
          (thread: any) => !emailIds.includes(thread.id) && !emailIds.includes(`thread:${thread.id}`)
        );
        
        return {
          ...cachedData,
          threads: updatedThreads,
        };
      },
      { revalidate: false }
    );
  }, [mutate, session?.user.id]);
  
  const invalidateFolders = useCallback((folders: FolderType[]) => {
    folders.forEach(folder => {
      mutate([session?.user.id, folder]);
    });
  }, [mutate, session?.user.id]);
  
  const checkEmailTags = useCallback(async (emailId: string): Promise<string[]> => {
    try {
      if (currentFolder === 'spam') {
        return ['SPAM'];
      } else if (currentFolder === 'inbox') {
        return ['INBOX'];
      } else if (currentFolder === 'archive') {
        return [];
      }
      
      return [];
    } catch (error) {
      console.error('Error checking email tags:', error);
      return [];
    }
  }, [currentFolder]);
  
  const archiveMail = useCallback(async (emailId: string) => {
    const tags = await checkEmailTags(emailId);
    if (tags.includes('SPAM')) {
      console.error("Cannot archive emails with SPAM label");
      return false;
    }
    
    console.log(`Archiving ${isThreadId(emailId) ? 'email' : 'thread'}: ${emailId}`);
    const success = await updateEmailLabels(emailId, [], ['INBOX']);
    
    if (success) {
      removeEmailsFromCache(currentFolder, [emailId]);
      invalidateFolders(['inbox', 'archive']);
    }
    
    return success;
  }, [updateEmailLabels, removeEmailsFromCache, invalidateFolders, currentFolder, checkEmailTags, isThreadId]);
  
  const moveToSpam = useCallback(async (emailId: string) => {
    const tags = await checkEmailTags(emailId);
    if (!tags.includes('INBOX') && currentFolder !== 'inbox') {
      console.error("Can only mark emails as spam from inbox");
      return false;
    }
    
    if (tags.includes('SENT')) {
      console.error("Cannot mark sent emails as spam");
      return false;
    }
    
    console.log(`Moving ${isThreadId(emailId) ? 'thread' : 'email'} to spam: ${emailId}`);
    const success = await updateEmailLabels(emailId, ['SPAM'], ['INBOX']);
    
    if (success) {
      removeEmailsFromCache(currentFolder, [emailId]);
      invalidateFolders(['inbox', 'spam']);
    }
    
    return success;
  }, [updateEmailLabels, removeEmailsFromCache, invalidateFolders, currentFolder, checkEmailTags, isThreadId]);
  
  const moveToInbox = useCallback(async (emailId: string) => {
    console.log(`Moving ${isThreadId(emailId) ? 'thread' : 'email'} to inbox: ${emailId}`);
    const success = await updateEmailLabels(emailId, ['INBOX'], ['SPAM']);
    
    if (success) {
      removeEmailsFromCache(currentFolder, [emailId]);
      invalidateFolders(['inbox', 'spam', 'archive']);
    }
    
    return success;
  }, [updateEmailLabels, removeEmailsFromCache, invalidateFolders, currentFolder, isThreadId]);
  
  const archiveEmails = useCallback(async (emailIds: string[]) => {
    if (currentFolder === 'spam') {
      console.error("Cannot archive emails from spam folder");
      return false;
    }
    
    const success = await Promise.all(
      emailIds.map((id) => archiveMail(id))
    ).then((results) => results.every(Boolean));
    
    return success;
  }, [archiveMail, currentFolder]);

  const moveEmailsToSpam = useCallback(async (emailIds: string[]) => {
    if (currentFolder !== 'inbox') {
      console.error("Can only mark emails as spam from inbox");
      return false;
    }
    
    const success = await Promise.all(
      emailIds.map((id) => moveToSpam(id))
    ).then((results) => results.every(Boolean));
    
    return success;
  }, [moveToSpam, currentFolder]);
  
  const archiveMultiple = useCallback(
    async (ids: string[]) => {
      console.log('Starting bulk archive operation for', ids.length, 'items');
      
      try {
        const result = await batchUpdateLabels({
          messageIds: ids,
          removeLabels: ['INBOX']
        });
        
        if (result.success) {
          removeEmailsFromCache(currentFolder, ids);
          invalidateFolders(['inbox', 'archive']);
          console.log(`Bulk archive completed successfully for ${ids.length} items`);
          return true;
        } else {
          console.error('Error in bulk archive operation:', result.error);
          return false;
        }
      } catch (error) {
        console.error('Error in bulk archive operation:', error);
        throw error;
      }
    },
    [removeEmailsFromCache, invalidateFolders, currentFolder]
  );

  const moveToSpamMultiple = useCallback(
    async (ids: string[]) => {
      console.log('Starting bulk move to spam operation for', ids.length, 'items');
      
      try {
        if (currentFolder !== 'inbox') {
          console.error("Can only mark emails as spam from inbox");
          return false;
        }
        
        const filteredIds = await Promise.all(
          ids.map(async (id) => {
            const tags = await checkEmailTags(id);
            const isSent = tags.includes('SENT');
            return { id, isSent };
          })
        ).then(results => 
          results.filter(item => !item.isSent).map(item => item.id)
        );
        
        if (filteredIds.length === 0) {
          console.log("No eligible emails to mark as spam (all are sent emails)");
          return false;
        }
        
        if (filteredIds.length !== ids.length) {
          console.log(`Filtered out ${ids.length - filteredIds.length} sent emails from spam operation`);
        }
        
        const result = await batchUpdateLabels({
          messageIds: filteredIds,
          addLabels: ['SPAM'],
          removeLabels: ['INBOX']
        });
        
        if (result.success) {
          removeEmailsFromCache(currentFolder, ids);
          invalidateFolders(['inbox', 'spam']);
          console.log(`Bulk move to spam completed successfully for ${filteredIds.length} items`);
          return true;
        } else {
          console.error('Error in bulk move to spam operation:', result.error);
          return false;
        }
      } catch (error) {
        console.error('Error in bulk move to spam operation:', error);
        throw error;
      }
    },
    [removeEmailsFromCache, invalidateFolders, currentFolder, checkEmailTags]
  );

  const moveToInboxMultiple = useCallback(
    async (ids: string[]) => {
      console.log('Starting bulk move to inbox operation for', ids.length, 'items');
      
      try {
        const result = await batchUpdateLabels({
          messageIds: ids,
          addLabels: ['INBOX'],
          removeLabels: ['SPAM']
        });
        
        if (result.success) {
          removeEmailsFromCache(currentFolder, ids);
          invalidateFolders(['inbox', 'spam', 'archive']);
          console.log(`Bulk move to inbox completed successfully for ${ids.length} items`);
          return true;
        } else {
          console.error('Error in bulk move to inbox operation:', result.error);
          return false;
        }
      } catch (error) {
        console.error('Error in bulk move to inbox operation:', error);
        throw error;
      }
    },
    [removeEmailsFromCache, invalidateFolders, currentFolder]
  );
  
  return {
    archiveMail,
    moveToSpam,
    moveToInbox,
    removeEmailsFromCache,
    invalidateFolders,
    archiveEmails,
    moveEmailsToSpam,
    archiveMultiple,
    moveToSpamMultiple,
    moveToInboxMultiple
  };
} 