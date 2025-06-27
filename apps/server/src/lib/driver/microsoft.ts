import {
  deleteActiveConnection,
  FatalErrors,
  fromBase64Url,
  sanitizeContext,
  StandardizedError,
} from './utils';
import type {
  OutlookCategory as Category,
  MailFolder,
  Message,
  User,
} from '@microsoft/microsoft-graph-types';
import type { IOutgoingMessage, Label, ParsedMessage } from '../../types';
import { sanitizeTipTapHtml } from '../sanitize-tip-tap-html';
import { Client } from '@microsoft/microsoft-graph-client';
import type { MailManager, ManagerConfig } from './types';
import { getContext } from 'hono/context-storage';
import type { CreateDraftData } from '../schemas';
import type { HonoContext } from '../../ctx';
import * as he from 'he';

export class OutlookMailManager implements MailManager {
  private graphClient: Client;

  constructor(public config: ManagerConfig) {
    const getAccessToken = async () => {
      const c = getContext<HonoContext>();
      const data = await c.var.auth.api.getAccessToken({
        body: {
          providerId: 'microsoft',
          userId: config.auth.userId,
          // accountId: config.auth.accountId,
        },
        headers: c.req.raw.headers,
      });
      if (!data.accessToken) throw new Error('Failed to get access token');
      return data.accessToken;
    };

    this.graphClient = Client.initWithMiddleware({
      authProvider: {
        getAccessToken,
      },
    });
  }

  public getScope(): string {
    return [
      'https://graph.microsoft.com/User.Read',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'offline_access',
    ].join(' ');
  }
  public getAttachment(messageId: string, attachmentId: string) {
    return this.withErrorHandler(
      'getAttachment',
      async () => {
        const response = await this.graphClient
          .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
          .get();

        const attachment = response;

        if (!attachment || !attachment.contentBytes) {
          throw new Error('Attachment data not found');
        }

        const base64 = fromBase64Url(attachment.contentBytes);

        return base64;
      },
      { messageId, attachmentId },
    );
  }
  public getEmailAliases() {
    return this.withErrorHandler('getEmailAliases', async () => {
      const user: User = await this.graphClient.api('/me').select('mail,userPrincipalName').get();
      const primaryEmail = user.mail || user.userPrincipalName || '';

      const aliases: { email: string; name?: string; primary?: boolean }[] = [
        { email: primaryEmail, primary: true },
      ];

      return aliases;
    });
  }
  public markAsRead(messageIds: string[]) {
    return this.withErrorHandler(
      'markAsRead',
      async () => {
        await this.modifyMessageReadStatus(messageIds, true);
      },
      { messageIds },
    );
  }
  public markAsUnread(messageIds: string[]) {
    return this.withErrorHandler(
      'markAsUnread',
      async () => {
        await this.modifyMessageReadStatus(messageIds, false);
      },
      { messageIds },
    );
  }
  private async modifyMessageReadStatus(messageIds: string[], isRead: boolean) {
    if (messageIds.length === 0) {
      return;
    }

    const batchRequests = messageIds.map((id, index) => ({
      id: `${index}`,
      method: 'PATCH',
      url: `/me/messages/${id}`,
      body: { isRead: isRead },
      headers: { 'Content-Type': 'application/json' },
    }));

    try {
      await this.graphClient.api('/$batch').post({ requests: batchRequests });
    } catch (error) {
      console.error('Error during batch update of message read status:', error);
      throw error;
    }
  }
  public getUserInfo() {
    return this.withErrorHandler(
      'getUserInfo',
      async () => {
        const user: User = await this.graphClient
          .api('/me')
          .select('id,displayName,userPrincipalName,mail')
          .get();

        let photoUrl = '';
        try {
          // Requires separate fetching logic
        } catch (error: unknown) {
          console.warn(
            'Could not fetch user photo:',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }

        const info = {
          address: user.mail || user.userPrincipalName || '',
          name: user.displayName || '',
          photo: photoUrl,
        };

        return info;
      },
      {},
    );
  }
  public getTokens<T>(code: string) {
    return this.withErrorHandler(
      'getTokens',
      async () => {
        const tokens = {
          accessToken: this.config.auth?.accessToken,
          refreshToken: this.config.auth?.refreshToken,
        };
        return { tokens } as T;
      },
      { code },
    );
  }
  public count() {
    return this.withErrorHandler(
      'count',
      async () => {
        const userLabels = await this.graphClient.api('/me/mailfolders').get();

        if (!userLabels.value) {
          return [];
        }

        const folders = await Promise.all(
          userLabels.value.map(async (folder: MailFolder) => {
            try {
              const res = await this.graphClient.api(`/me/mailfolders/${folder.id}`).get();

              let normalizedLabel = res.displayName || res.id || '';

              if (res.displayName === 'Inbox' || res.id?.toLowerCase() === 'inbox')
                normalizedLabel = 'Inbox';
              else if (res.displayName === 'Sent Items' || res.id?.toLowerCase() === 'sentitems')
                normalizedLabel = 'Sent';
              else if (res.displayName === 'Drafts' || res.id?.toLowerCase() === 'drafts')
                normalizedLabel = 'Drafts';
              else if (
                res.displayName === 'Deleted Items' ||
                res.id?.toLowerCase() === 'deleteditems'
              )
                normalizedLabel = 'Bin';
              else if (res.displayName === 'Archive' || res.id?.toLowerCase() === 'archive')
                normalizedLabel = 'Archive';
              else if (res.displayName === 'Junk Email' || res.id?.toLowerCase() === 'junkemail')
                normalizedLabel = 'Spam';

              // Use unreadItemCount only for Inbox, use totalItemCount for all other folders
              const count =
                res.id?.toLowerCase() === 'inbox'
                  ? Number(res.unreadItemCount)
                  : Number(res.totalItemCount);

              return {
                label: normalizedLabel,
                count: count ?? undefined,
              };
            } catch (error) {
              console.error(`Error getting counts for folder ${folder.id}:`, error);
              return {
                label: folder.displayName || folder.id || '',
                count: undefined,
              };
            }
          }),
        );

        return folders;
      },
      { email: this.config.auth?.email },
    );
  }
  public list(params: {
    folder: string;
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    pageToken?: string;
  }) {
    const { folder, query: q, maxResults = 100, pageToken } = params;

    let folderId = this.getOutlookFolderId(folder);
    if (!folderId) {
      folderId = folder;
    }

    let request = this.graphClient.api(`/me/mailFolders/${folderId}/messages`).top(maxResults);

    // if (q) {
    //   request = request.search(`"${q}"`);
    // }

    request = request.select(
      'id,subject,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,internetMessageId,inferenceClassification,categories,parentFolderId',
    );

    if (maxResults > 0) {
      request = request.top(maxResults);
    }
    if (pageToken) {
      console.warn(
        'Outlook pagination typically uses @odata.nextLink (full URL). pageToken needs to be handled accordingly.',
      );
    }

    // request = request.orderby('receivedDateTime desc');

    return this.withErrorHandler(
      'list',
      async () => {
        const res = await request.get();

        // console.log(JSON.stringify(res, null, 4));

        const messages: Message[] = res.value;
        const nextPageLink: string | undefined = res['@odata.nextLink'];

        // First parse all messages to get basic info
        const parsedMessages = await Promise.all(
          messages.map((msg) => this.parseOutlookMessage(msg)),
        );

        // Then fetch full content for each message
        const fullMessages = await Promise.all(
          messages.map(async (msg, index) => {
            try {
              // Get the full message content using the get method
              const fullMessage = await this.get(msg.id || '');
              return {
                ...parsedMessages[index],
                ...fullMessage.latest,
                decodedBody: fullMessage.latest.decodedBody || '',
              };
            } catch (error) {
              console.error(`Failed to fetch full message for ${msg.id}:`, error);
              // If get fails, fall back to basic message info
              return {
                ...parsedMessages[index],
                body: '',
                processedHtml: '',
                blobUrl: '',
                decodedBody: '',
                attachments: [],
              };
            }
          }),
        );

        // Format response according to interface requirements
        return {
          threads: messages.map((msg, index) => ({
            id: msg.id || msg.internetMessageId || '',
            historyId: msg.lastModifiedDateTime ?? null,
            $raw: {
              ...msg,
              ...fullMessages[index],
            },
          })),
          nextPageToken: nextPageLink || null,
        };
      },
      {
        folder,
        q,
        maxResults,
        _labelIds: params.labelIds,
        pageToken,
        email: this.config.auth?.email,
      },
    );
  }
  private getOutlookFolderId(folderName: string): string | undefined {
    switch (folderName.toLowerCase()) {
      case 'inbox':
        return 'inbox';
      case 'sent':
        return 'sentitems';
      case 'drafts':
        return 'drafts';
      case 'bin':
      case 'trash':
        return 'deleteditems';
      case 'archive':
        return 'archive';
      case 'junk':
      case 'spam':
        return 'junkemail';
      default:
        return undefined;
    }
  }
  public get(id: string) {
    return this.withErrorHandler(
      'get',
      async () => {
        const message: Message = await this.graphClient
          .api(`/me/messages/${id}`)
          .select(
            'id,subject,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,internetMessageId,inferenceClassification,categories,attachments',
          )
          .get();

        if (!message) {
          throw new Error('Message not found');
        }

        const bodyContent = message.body?.content || '';
        const bodyContentType = message.body?.contentType?.toLowerCase() || 'text';

        let decodedBody = '';
        if (bodyContentType === 'html') {
          decodedBody = he.decode(bodyContent);
        } else {
          decodedBody = he.decode(bodyContent).replace(/\n/g, '<br>');
        }

        const attachmentsData = message.attachments || [];

        const attachments = await Promise.all(
          attachmentsData.map(async (att) => {
            if (!att.id || !att.name || att.size === undefined || att.contentType === undefined) {
              return null;
            }
            const attachmentContent = await this.graphClient
              .api(`/me/messages/${message.id}/attachments/${att.id}`)
              .get();

            if (!attachmentContent.contentBytes) {
              return null;
            }

            return {
              filename: att.name,
              mimeType: att.contentType ?? 'application/octet-stream',
              size: att.size,
              attachmentId: att.id,
              headers: [],
              body: attachmentContent.contentBytes,
            };
          }),
        ).then((attachments) => attachments.filter((a): a is NonNullable<typeof a> => a !== null));

        const parsedData = this.parseOutlookMessage(message);

        const fullEmailData = {
          ...parsedData,
          body: '',
          processedHtml: '',
          blobUrl: '',
          decodedBody: decodedBody,
          attachments,
        };

        return {
          labels: parsedData.tags,
          messages: [fullEmailData],
          latest: fullEmailData,
          hasUnread: parsedData.unread,
          totalReplies: 1,
        };
      },
      { id, email: this.config.auth?.email },
    );
  }
  public create(data: IOutgoingMessage) {
    return this.withErrorHandler(
      'create',
      async () => {
        const messagePayload = await this.parseOutgoingOutlook(data);

        const res = await this.graphClient.api('/me/sendMail').post({
          message: messagePayload,
          saveToSentItems: true,
        });

        return res;
      },
      { data, email: this.config.auth?.email },
    );
  }
  public delete(id: string) {
    return this.withErrorHandler(
      'delete',
      async () => {
        await this.graphClient.api(`/me/messages/${id}`).delete();
      },
      { id },
    );
  }
  public normalizeIds(ids: string[]) {
    return this.withSyncErrorHandler(
      'normalizeIds',
      () => {
        const messageIds: string[] = ids.map((id) =>
          id.startsWith('thread:') ? id.substring(7) : id,
        );
        return { threadIds: messageIds }; // Renamed from threadIds to messageIds conceptually
      },
      { ids },
    );
  }
  public modifyLabels(
    messageIds: string[],
    options: { addLabels: string[]; removeLabels: string[] },
  ) {
    return this.withErrorHandler(
      'modifyLabels',
      async () => {
        await this.modifyMessageLabelsOrFolders(
          messageIds,
          options.addLabels,
          options.removeLabels,
        );
      },
      { messageIds, options },
    );
  }
  private async modifyMessageLabelsOrFolders(
    messageIds: string[],
    addItems: string[],
    removeItems: string[],
  ) {
    if (messageIds.length === 0) {
      return;
    }
    const batchRequests = messageIds.map((id, index) => {
      const patchBody = {};

      if (addItems.length > 0 || removeItems.length > 0) {
        console.warn(
          `Modifying categories (${addItems.join(',')}, ${removeItems.join(',')}) on message ${id} is not fully implemented.`,
        );
      }

      if (!addItems[0]) {
        console.warn('No addItems');
        return;
      }

      let moveToFolderId: string | undefined;
      if (addItems.length > 0 && this.getOutlookFolderId(addItems[0])) {
        moveToFolderId = this.getOutlookFolderId(addItems[0]) || addItems[0];
        console.warn(
          `Attempting to move message ${id} to folder ${moveToFolderId}. This is a move operation, not adding a label.`,
        );
        return {
          id: `${index}`,
          method: 'POST',
          url: `/me/messages/${id}/move`,
          body: { destinationId: moveToFolderId },
          headers: { 'Content-Type': 'application/json' },
        };
      }
      return {
        id: `${index}`,
        method: 'PATCH',
        url: `/me/messages/${id}`,
        body: patchBody,
        headers: { 'Content-Type': 'application/json' },
      };
    });

    const validBatchRequests = batchRequests
      .filter((req) => typeof req !== 'undefined')
      .filter((req) => Object.keys(req.body).length > 0 || req.method === 'POST');

    if (validBatchRequests.length === 0) {
      console.warn('No valid batch requests generated for modifyMessageLabelsOrFolders.');
      return;
    }

    try {
      await this.graphClient.api('/$batch').post({ requests: validBatchRequests });
    } catch (error) {
      console.error('Error during batch modification of messages:', error);
      throw error;
    }
  }
  public sendDraft(draftId: string, data: IOutgoingMessage) {
    return this.withErrorHandler(
      'sendDraft',
      async () => {
        await this.graphClient.api(`/me/drafts/${draftId}/send`).post({});
      },
      { draftId, data },
    );
  }
  public getDraft(draftId: string) {
    return this.withErrorHandler(
      'getDraft',
      async () => {
        const draftMessage: Message = await this.graphClient
          .api(`/me/messages/${draftId}`) // Drafts are messages in the drafts folder
          .select('id,subject,body,from,toRecipients,ccRecipients,bccRecipients')
          .get();

        if (!draftMessage) {
          throw new Error('Draft not found');
        }

        const parsedDraft = this.parseOutlookDraft(draftMessage);
        if (!parsedDraft) {
          throw new Error('Failed to parse draft');
        }

        return parsedDraft;
      },
      { draftId },
    );
  }
  public listDrafts(params: { q?: string; maxResults?: number; pageToken?: string }) {
    const { q, maxResults = 20, pageToken } = params;
    return this.withErrorHandler(
      'listDrafts',
      async () => {
        let request = this.graphClient.api('/me/mailfolders/drafts/messages');

        // if (q) {
        //   request = request.search(`"${q}"`);
        // }

        request = request.select(
          'id,subject,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,receivedDateTime,isRead,internetMessageId',
        );
        // request = request.orderby('receivedDateTime desc');
        request = request.top(maxResults);

        if (pageToken) {
          console.warn(
            'Outlook pagination typically uses @odata.nextLink (full URL). pageToken needs to be handled accordingly.',
          );
        }

        const res = await request.get();

        const draftMessages: Message[] = res.value;
        const nextPageLink: string | undefined = res['@odata.nextLink'];

        const drafts = await Promise.all(
          draftMessages.map(async (message) => {
            if (!message.id) return null;
            try {
              const parsed = this.parseOutlookMessage(message);
              return {
                ...parsed,
                id: message.id,
                threadId: message.conversationId || message.id,
                receivedOn: message.receivedDateTime || new Date().toISOString(),
              };
            } catch (error) {
              console.error('Error parsing draft message:', error);
              return null;
            }
          }),
        );

        const sortedDrafts = drafts
          .filter((draft) => draft !== null)
          .sort((a, b) => {
            const dateA = new Date(a?.receivedOn || new Date()).getTime();
            const dateB = new Date(b?.receivedOn || new Date()).getTime();
            return dateB - dateA;
          });

        return {
          threads: sortedDrafts.map((draft) => ({
            id: draft.id,
            historyId: null,
            $raw: draft,
          })),
          nextPageToken: nextPageLink || null,
        };
      },
      { q, maxResults, pageToken },
    );
  }
  public createDraft(data: CreateDraftData) {
    return this.withErrorHandler(
      'createDraft',
      async () => {
        const { html: message, inlineImages } = await sanitizeTipTapHtml(data.message);

        const toRecipients = Array.isArray(data.to) ? data.to : data.to.split(', ');

        const outlookMessage: Message = {
          subject: data.subject,
          body: {
            contentType: 'html',
            content: message || '',
          },
          toRecipients: toRecipients.map((recipient) => ({
            emailAddress: {
              address: typeof recipient === 'string' ? recipient : recipient.email,
              name: typeof recipient === 'string' ? undefined : recipient.name || undefined,
            },
          })),
        };

        if (data.cc) {
          const ccRecipients = Array.isArray(data.cc) ? data.cc : data.cc.split(', ');
          outlookMessage.ccRecipients = ccRecipients.map((recipient) => ({
            emailAddress: {
              address: typeof recipient === 'string' ? recipient : recipient.email,
              name: typeof recipient === 'string' ? undefined : recipient.name || undefined,
            },
          }));
        }

        if (data.bcc) {
          const bccRecipients = Array.isArray(data.bcc) ? data.bcc : data.bcc.split(', ');
          outlookMessage.bccRecipients = bccRecipients.map((recipient) => ({
            emailAddress: {
              address: typeof recipient === 'string' ? recipient : recipient.email,
              name: typeof recipient === 'string' ? undefined : recipient.name || undefined,
            },
          }));
        }

        const allAttachments = [];

        if (inlineImages.length > 0) {
          for (const image of inlineImages) {
            allAttachments.push({
              '@odata.type': '#microsoft.graph.fileAttachment',
              name: image.cid,
              contentType: image.mimeType,
              contentBytes: image.data,
              contentId: image.cid,
              isInline: true,
            });
          }
        }

        if (data.attachments && data.attachments.length > 0) {
          const regularAttachments = await Promise.all(
            data.attachments.map(async (file) => {
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const base64Content = buffer.toString('base64');

              return {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: file.name,
                contentType: file.type || 'application/octet-stream',
                contentBytes: base64Content,
              };
            }),
          );
          allAttachments.push(...regularAttachments);
        }

        if (allAttachments.length > 0) {
          outlookMessage.attachments = allAttachments;
        }

        let res;

        if (data.id) {
          try {
            res = await this.graphClient
              .api(`/me/mailfolders/drafts/messages/${data.id}`)
              .patch(outlookMessage);
          } catch (error) {
            console.warn(`Failed to update draft ${data.id}, creating a new one`, error);
            try {
              await this.graphClient.api(`/me/mailfolders/drafts/messages/${data.id}`).delete();
            } catch (deleteError) {
              console.error(`Failed to delete draft ${data.id}`, deleteError);
            }

            res = await this.graphClient
              .api('/me/mailfolders/drafts/messages')
              .post(outlookMessage);
          }
        } else {
          res = await this.graphClient.api('/me/mailfolders/drafts/messages').post(outlookMessage);
        }

        return res;
      },
      { data },
    );
  }
  public async getUserLabels() {
    try {
      // Get root mail folders
      const rootFoldersResponse = await this.graphClient.api('/me/mailfolders').get();
      const rootFolders: MailFolder[] = rootFoldersResponse.value || [];

      // System folders to identify
      const systemFolderNames = [
        'inbox',
        'drafts',
        'sentitems',
        'deleteditems',
        'archive',
        'outbox',
        'junkemail',
        'clutter',
        'notes',
        'journal',
        'calendar',
        'contacts',
        'tasks',
        'conversationhistory',
      ];

      const processedFolders = await this.processMailFoldersHierarchy(
        rootFolders,
        systemFolderNames,
      );

      console.log('Microsoft labels with hierarchy:', processedFolders);
      return processedFolders;
    } catch (error) {
      console.error('Error fetching Outlook categories or folders:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      return [];
    }
  }
  private async processMailFoldersHierarchy(
    folders: MailFolder[],
    systemFolderNames: string[],
    depth: number = 0,
    maxDepth: number = 99,
  ): Promise<Label[]> {
    if (depth >= maxDepth) {
      return [];
    }

    const result: Label[] = [];

    for (const folder of folders) {
      if (!folder.id) continue;

      try {
        const folderType = systemFolderNames.includes(folder.displayName?.toLowerCase() || '')
          ? 'system'
          : 'user';
        const childFoldersResponse = await this.graphClient
          .api(`/me/mailFolders/${folder.id}/childFolders`)
          .get();

        const childFolders: MailFolder[] = childFoldersResponse.value || [];

        const childLabels = await this.processMailFoldersHierarchy(
          childFolders,
          systemFolderNames,
          depth + 1,
          maxDepth,
        );

        const label: Label = {
          id: folder.id,
          name: folder.displayName || '',
          type: folderType,
          color: {
            backgroundColor: '',
            textColor: '',
          },
        };

        if (childLabels.length > 0) {
          label.labels = childLabels;
        }

        result.push(label);
      } catch (error) {
        console.error(`Error processing folder ${folder.displayName || folder.id}:`, error);
      }
    }

    return result;
  }
  public async getLabel(labelId: string): Promise<Label> {
    console.warn('getLabel needs to differentiate between Category ID and Mail Folder ID.');

    try {
      const folder: MailFolder = await this.graphClient.api(`/me/mailfolders/${labelId}`).get();
      return {
        id: folder.id || '',
        name: folder.displayName || '',
        type: 'user',
        color: { backgroundColor: '', textColor: '' },
      };
    } catch (folderError) {
      try {
        const category: Category = await this.graphClient
          .api(`/me/outlook/masterCategories/${labelId}`)
          .get();
        return {
          id: category.id || category.displayName || '',
          name: category.displayName || '',
          type: 'category',
          color: { backgroundColor: category.color || '', textColor: '' },
        };
      } catch (categoryError) {
        console.error(
          `Label or folder with id ${labelId} not found as Folder or Category:`,
          folderError,
          categoryError,
        );
        throw new Error(`Label or folder with id ${labelId} not found`);
      }
    }
  }
  public async createLabel(label: {
    name: string;
    color?: { backgroundColor: string; textColor: string };
  }) {
    console.warn(
      'createLabel defaults to creating a Mail Folder. Creating a Category uses a different API.',
    );

    try {
      const newFolder: MailFolder = await this.graphClient.api('/me/mailfolders').post({
        displayName: label.name,
        // parentFolderId: 'inbox', // Optional: Create under a specific parent folder
      });
      console.log('Mail Folder created:', newFolder);

      // create a Category:
      // const newCategory: Category = await this.graphClient.api('/me/outlook/masterCategories').post({
      //     displayName: label.name,
      //      color: 'presetColorEnum' // Graph category color is a string enum
      // });
      // console.log('Category created:', newCategory);
    } catch (error) {
      console.error('Error creating Outlook Mail Folder:', error);
      throw error;
    }
  }
  public async updateLabel(id: string, label: Label) {
    console.warn('updateLabel needs to differentiate between Category and Mail Folder updates.');

    try {
      await this.graphClient.api(`/me/mailfolders/${id}`).patch({
        displayName: label.name,
        // Folder colors are not updateable via Graph API
      });
      console.log(`Mail Folder ${id} updated.`);
    } catch (folderError) {
      try {
        await this.graphClient.api(`/me/outlook/masterCategories/${id}`).patch({
          displayName: label.name,
          // color: label.color?.backgroundColor, // Requires mapping hex to Graph color enum
        });
        console.log(`Category ${id} updated.`);
      } catch (categoryError) {
        console.error(
          `Could not update label or folder with id ${id} as Folder or Category:`,
          folderError,
          categoryError,
        );
        throw new Error(`Could not update label or folder with id ${id}`);
      }
    }
  }
  public async deleteLabel(id: string) {
    await this.graphClient.api(`/me/mailfolders/${id}`).delete();
  }
  public async revokeToken(token: string) {
    if (!token) return false;

    try {
      console.warn(
        'Revoking Microsoft refresh tokens requires MSAL or specific Azure AD endpoints, not a direct Graph API call. This method is a placeholder.',
      );
      return false;
    } catch (error: unknown) {
      console.error(
        'Failed to revoke Microsoft token:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      return false;
    }
  }
  private async modifyThreadLabels(
    threadIds: string[],
    requestBody: unknown, // Gmail-specific type, replace with relevant Outlook logic
  ) {
    // This method is Gmail-specific (modifying thread labels).
    // The equivalent in Outlook is modifying messages (read status, categories)
    // or moving messages between folders.
    // The logic from modifyMessageReadStatus and modifyMessageLabelsOrFolders is more relevant.
    console.warn(
      'modifyThreadLabels is a Gmail-specific concept. Use modifyMessageReadStatus or modifyMessageLabelsOrFolders.',
    );
    // Placeholder
    return Promise.resolve();
  }

  public deleteAllSpam() {
    console.warn('deleteAllSpam is not implemented for Microsoft');
    return Promise.resolve({
      success: false,
      message: 'Not implemented',
      count: 0,
    });
  }

  private normalizeSearch(folder: string, q: string) {
    // This normalization logic is based on Gmail's search syntax and folder mapping.
    // For Outlook/Graph, you need to translate to OData $filter or $search syntax
    // and map folder names to Outlook folder IDs.
    console.warn(
      'normalizeSearch is based on Gmail syntax. Needs translation to OData $filter or $search.',
    );

    let outlookQuery = q;
    let folderId: string | undefined;

    switch (folder.toLowerCase()) {
      case 'inbox':
        folderId = 'inbox';
        break;
      case 'bin':
      case 'trash':
        folderId = 'deleteditems';
        break;
      case 'archive':
        folderId = 'archive';
        break;
      case 'sent':
        folderId = 'sentitems';
        break;
      case 'drafts':
        folderId = 'drafts';
        break;
      default:
        folderId = folder;
        break;
    }

    // This is a very basic translation. A real implementation needs to parse Gmail queries
    // and build complex OData filter strings.
    if (q) {
      // Simple keyword search example
      outlookQuery = `"${q}"`;
    }

    return { folder: folderId, q: outlookQuery };
  }
  private parseOutlookMessage({
    id,
    conversationId, // Use conversationId as threadId equivalent
    subject,
    bodyPreview, // Snippet equivalent
    isRead,
    from,
    toRecipients,
    ccRecipients,
    bccRecipients,
    sentDateTime,
    receivedDateTime,
    internetMessageId,
    inferenceClassification, // Might indicate if junk
    categories, // Outlook categories map to tags
    parentFolderId, // Can indicate folder (e.g. 'deleteditems')
    // headers, // Array of Header objects (name, value), doesn't exist in Outlook
  }: Message): Omit<
    ParsedMessage,
    'body' | 'processedHtml' | 'blobUrl' | 'totalReplies' | 'attachments'
  > {
    const receivedOn = receivedDateTime || new Date().toISOString();
    const sender = from?.emailAddress
      ? {
          name: from.emailAddress.name || '',
          email: from.emailAddress.address || '',
        }
      : { name: 'Unknown', email: 'unknown@example.com' };

    const to =
      toRecipients?.map((rec) => ({
        name: rec.emailAddress?.name || '',
        email: rec.emailAddress?.address || '',
      })) || [];

    const cc =
      ccRecipients?.map((rec) => ({
        name: rec.emailAddress?.name || '',
        email: rec.emailAddress?.address || '',
      })) || null;

    const bcc =
      bccRecipients?.map((rec) => ({
        name: rec.emailAddress?.name || '',
        email: rec.emailAddress?.address || '',
      })) || [];

    const tags: Label[] =
      (categories || []).map((cat) => ({
        id: cat,
        name: cat,
        type: 'category',
        color: {
          backgroundColor: '',
          textColor: '',
        },
      })) || [];

    let references: string | undefined;
    let inReplyTo: string | undefined;
    let listUnsubscribe: string | undefined;
    let listUnsubscribePost: string | undefined;
    let replyTo: string | undefined;

    // TODO: use headers if available
    // if (headers) {
    //   const referencesHeader = headers.find((h) => h.name?.toLowerCase() === 'references');
    //   if (referencesHeader) references = referencesHeader.value || undefined;

    //   const inReplyToHeader = headers.find((h) => h.name?.toLowerCase() === 'in-reply-to');
    //   if (inReplyToHeader) inReplyTo = inReplyToHeader.value || undefined;

    //   const listUnsubscribeHeader = headers.find(
    //     (h) => h.name?.toLowerCase() === 'list-unsubscribe',
    //   );
    //   if (listUnsubscribeHeader) listUnsubscribe = listUnsubscribeHeader.value || undefined;

    //   const listUnsubscribePostHeader = headers.find(
    //     (h) => h.name?.toLowerCase() === 'list-unsubscribe-post',
    //   );
    //   if (listUnsubscribePostHeader)
    //     listUnsubscribePost = listUnsubscribePostHeader.value || undefined;

    //   const replyToHeader = headers.find((h) => h.name?.toLowerCase() === 'reply-to');
    //   if (replyToHeader) replyTo = replyToHeader.value || undefined;
    // }

    // TLS status is difficult to determine reliably from typical Graph message properties.
    // You'd need to examine "Received" headers if available and parse them, similar to the Gmail logic.
    // The `wasSentWithTLS` utility would need to be adapted or rewritten for Outlook header formats.
    const tls = false; // Placeholder - needs proper header parsing

    return {
      id: id || 'ERROR',
      bcc,
      threadId: conversationId || id || '',
      title: bodyPreview ? he.decode(bodyPreview).trim() : 'ERROR',
      tls: tls,
      tags: tags,
      listUnsubscribe,
      listUnsubscribePost,
      replyTo,
      references,
      inReplyTo,
      sender,
      unread: !isRead,
      to,
      cc,
      receivedOn: receivedOn.toString(),
      subject: subject ? he.decode(subject).trim() : '(no subject)',
      messageId: internetMessageId || id || 'ERROR',
    };
  }
  private async parseOutgoingOutlook({
    to,
    subject,
    message,
    attachments,
    headers,
    cc,
    bcc,
    fromEmail, // In Outlook, this is usually determined by the authenticated user unless using "send on behalf of" or "send as"
  }: IOutgoingMessage): Promise<Message> {
    // Outlook Graph API expects a Message object structure for sending/creating drafts
    console.log(to);
    const { html: processedMessage, inlineImages } = await sanitizeTipTapHtml(message.trim());
    const outlookMessage: Message = {
      subject: subject,
      body: {
        contentType: 'html', // Or 'text'
        content: processedMessage,
      },
      toRecipients:
        to?.map((rec) => ({
          emailAddress: {
            name: rec.name || '',
            address: rec.email,
          },
        })) || [],
      ccRecipients:
        cc?.map((rec) => ({
          emailAddress: {
            name: rec.name || '',
            address: rec.email,
          },
        })) || undefined,
      bccRecipients:
        bcc?.map((rec) => ({
          emailAddress: {
            name: rec.name || '',
            address: rec.email,
          },
        })) || undefined,
      // from, sender properties are often handled automatically by Graph based on auth
      // or require specific permissions (Send as, Send on behalf of) and different payload structure.
      // If fromEmail is provided and requires Send As/On Behalf permissions:
      // from: { emailAddress: { name: 'Sender Name', address: fromEmail } } // Requires permission
    };

    if (headers) {
      // Graph API doesn't have a direct 'headers' property for sending
      // Custom headers are usually not added this way.
      // Some headers like Reply-To can be set as properties, but not general headers.
      console.warn(
        'Custom headers from IOutgoingMessage are not directly applied when sending via Microsoft Graph API.',
      );
      // If you need to set specific headers like In-Reply-To or References for threading replies:
      // outlookMessage.internetMessageHeaders = Object.entries(headers).map(([name, value]) => ({ name, value: value?.toString() }));
      // Note: internetMessageHeaders might be read-only or limited for sending.
      // Setting properties like InReplyTo, References on the message object itself is the standard way if supported.
      // outlookMessage.inReplyTo = headers.inReplyTo as string | undefined; // Example if supported
      // outlookMessage.references = headers.references as string | undefined; // Example if supported
    }

    // Handle inline images and attachments
    const allAttachments = [];

    if (inlineImages.length > 0) {
      for (const image of inlineImages) {
        allAttachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: image.cid,
          contentType: image.mimeType,
          contentBytes: image.data,
          contentId: image.cid,
          isInline: true,
        });
      }
    }

    if (attachments?.length > 0) {
      const regularAttachments = await Promise.all(
        attachments.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Content = buffer.toString('base64');

          return {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: file.name,
            contentType: file.type || 'application/octet-stream',
            contentBytes: base64Content,
          };
        }),
      );
      allAttachments.push(...regularAttachments);
    }

    if (allAttachments.length > 0) {
      outlookMessage.attachments = allAttachments;
    }

    return outlookMessage;
  }
  private parseOutlookDraft(draftMessage: Message) {
    if (!draftMessage) return null;

    const to =
      draftMessage.toRecipients?.map((rec) => rec.emailAddress?.address || '').filter(Boolean) ||
      [];
    const subject = draftMessage.subject;

    let content = '';
    if (draftMessage.body?.content) {
      content = draftMessage.body.content;
      if (draftMessage.body.contentType?.toLowerCase() === 'text') {
        content = content.replace(/\n/g, '<br>'); // Basic text to HTML
      }
    }

    const cc =
      draftMessage.ccRecipients?.map((rec) => rec.emailAddress?.address || '').filter(Boolean) ||
      [];
    const bcc =
      draftMessage.bccRecipients?.map((rec) => rec.emailAddress?.address || '').filter(Boolean) ||
      [];

    return {
      id: draftMessage.id || '',
      to,
      cc,
      bcc,
      subject: subject ? he.decode(subject).trim() : '',
      content,
      rawMessage: draftMessage, // Include raw Graph message
    };
  }
  private async withErrorHandler<T>(
    operation: string,
    fn: () => Promise<T> | T,
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await Promise.resolve(fn());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Adapt error checking for Microsoft Graph errors
      const isFatal =
        FatalErrors.includes(error.message) ||
        (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429); // Consider 4xx errors other than 429 as potentially fatal depending on the error
      console.error(
        `[${isFatal ? 'FATAL_ERROR' : 'ERROR'}] [Outlook Driver] Operation: ${operation}`,
        {
          error: error.message,
          code: error.code, // Graph errors might have error.code
          statusCode: error.statusCode, // Graph errors have status codes
          context: sanitizeContext(context),
          stack: error.stack,
          isFatal,
        },
      );
      if (isFatal) await deleteActiveConnection();
      throw new StandardizedError(error, operation, context);
    }
  }
  private withSyncErrorHandler<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, unknown>,
  ): T {
    try {
      return fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const isFatal =
        FatalErrors.includes(error.message) ||
        (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429);
      console.error(`[Outlook Driver Error] Operation: ${operation}`, {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
        context: sanitizeContext(context),
        stack: error.stack,
        isFatal,
      });
      if (isFatal) void deleteActiveConnection();
      throw new StandardizedError(error, operation, context);
    }
  }
}
