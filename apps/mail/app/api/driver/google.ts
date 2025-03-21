import { type IConfig, type MailManager } from "./types";
import { type gmail_v1, google } from "googleapis";
import { EnableBrain } from "@/actions/brain";
import { type ParsedMessage } from "@/types";
import * as he from "he";
import { parseFrom, wasSentWithTLS } from "@/lib/email-utils";

function fromBase64Url(str: string) {
  return str.replace(/-/g, "+").replace(/_/g, "/");
}

function fromBinary(str: string) {
  return decodeURIComponent(
    atob(str.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
}

const findHtmlBody = (parts: any[]): string => {
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      console.log("✓ Driver: Found HTML content in message part");
      return part.body.data;
    }
    if (part.parts) {
      const found = findHtmlBody(part.parts);
      if (found) return found;
    }
  }
  console.log("⚠️ Driver: No HTML content found in message parts");
  return "";
};

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID as string,
  process.env.GOOGLE_CLIENT_SECRET as string,
  process.env.GOOGLE_REDIRECT_URI as string,
)

interface ParsedDraft {
  id: string;
  to?: string[];
  subject?: string;
  content?: string;
  rawMessage?: gmail_v1.Schema$Message;
}

const parseDraft = (draft: gmail_v1.Schema$Draft): ParsedDraft | null => {
  if (!draft.message) return null;

  const headers = draft.message.payload?.headers || [];
  const to =
    headers
      .find((h) => h.name === "To")
      ?.value?.split(",")
      .map((e) => e.trim())
      .filter(Boolean) || [];
  const subject = headers.find((h) => h.name === "Subject")?.value;

  let content = "";
  const payload = draft.message.payload;

  if (payload) {
    if (payload.parts) {
      const textPart = payload.parts.find((part) => part.mimeType === "text/plain");
      if (textPart?.body?.data) {
        content = fromBinary(textPart.body.data);
      }
    } else if (payload.body?.data) {
      content = fromBinary(payload.body.data);
    }
  }

  return {
    id: draft.id || "",
    to,
    subject: subject ? he.decode(subject).trim() : "",
    content,
    rawMessage: draft.message,
  };
};

interface ProcessMultipleThreadsProps {
  threadIds: string[],
  addLabelIds: string[],
  removeLabelIds: string[]
}

async function processMultipleThreads(props: ProcessMultipleThreadsProps){

  const { threadIds, addLabelIds = [], removeLabelIds = [] } = props
  const gmail = google.gmail({version: 'v1', auth})

  if(threadIds.length === 0){
    throw new Error("No thread IDs provided!")
  }

  if(addLabelIds.length === 0 || removeLabelIds.length === 0){
    return
  }

  try {
  const threadPromises = threadIds.map(async (threadId) => {
    const threadResponse = await gmail.users.threads.get({
      userId: "me",
      id: threadId
    })

    return threadResponse.data.messages?.map(message => message.id).filter((id): id is string => id != null && id != undefined) || []
  })

  const messageArrays = await Promise.all(threadPromises)
  const allMessagesIds = messageArrays.flat()

  if(allMessagesIds.length > 0){
    await gmail.users.messages.batchModify({
      userId: "me",
      requestBody: {
        ids: allMessagesIds,
        removeLabelIds: removeLabelIds,
        addLabelIds: addLabelIds
      }
    })



  }
} catch(error){
  console.error("Error while processing multiple threads:", error)
  throw error
}
  
}

export const driver = async (config: IConfig): Promise<MailManager> => {

  const getScope = () =>
    [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");
  if (config.auth) {
    auth.setCredentials({
      refresh_token: config.auth.refresh_token,
      scope: getScope(),
    });
    EnableBrain()
      .then(() => console.log("✅ Driver: Enabled"))
      .catch(() => console.log("✅ Driver: Enabled"));
  }
  const parse = ({
    id,
    threadId,
    snippet,
    labelIds,
    payload,
  }: gmail_v1.Schema$Message): Omit<
    ParsedMessage,
    "body" | "processedHtml" | "blobUrl" | "totalReplies"
  > => {
    const receivedOn =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "date")?.value || "Failed";
    const sender =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value || "Failed";
    const subject =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
    const references =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "references")?.value || "";
    const inReplyTo =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "in-reply-to")?.value || "";
    const messageId =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "message-id")?.value || "";
    const listUnsubscribe =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "list-unsubscribe")?.value ||
      undefined;
    const listUnsubscribePost =
      payload?.headers?.find((h) => h.name?.toLowerCase() === "list-unsubscribe-post")?.value ||
      undefined;

    const receivedHeaders = payload?.headers?.filter(header => header.name?.toLowerCase() === 'received')
      .map(header => header.value || '') || [];
    const hasTLSReport = payload?.headers?.some(header => header.name?.toLowerCase() === 'tls-report');

    return {
      id: id || "ERROR",
      threadId: threadId || "",
      title: snippet ? he.decode(snippet).trim() : "ERROR",
      tls: wasSentWithTLS(receivedHeaders) || !!hasTLSReport,
      tags: labelIds || [],
      listUnsubscribe,
      listUnsubscribePost,
      references,
      inReplyTo,
      sender: parseFrom(sender),
      unread: labelIds ? labelIds.includes("UNREAD") : false,
      receivedOn,
      subject: subject ? subject.replace(/"/g, "").trim() : "(no subject)",
      messageId,
    };
  };
  const normalizeSearch = (folder: string, q: string) => {
    if (folder === "trash") {
      return { folder: undefined, q: `in:trash ${q}` };
    }
    return { folder, q };
  };
  const gmail = google.gmail({ version: "v1", auth });
  const manager = {
    getAttachment: async (messageId: string, attachmentId: string) => {
      try {
        const response = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId,
          id: attachmentId,
        });

        const attachmentData = response.data.data || "";

        const base64 = fromBase64Url(attachmentData);

        return base64;
      } catch (error) {
        console.error("Error fetching attachment:", error);
        throw error;
      }
    },
    markAsRead: async (ids: string[]) => {
			try {
        const args = {
          threadIds: ids,
          addLabelIds: [],
          removeLabelIds: ["UNREAD"]
        }
        await processMultipleThreads(args)
			} catch (error) {
				console.error('Error marking messages as read:', error);
        throw error
			}
		},
    markAsUnread: async (ids: string[]) => {
      try {
        const args = {
          threadIds: ids,
          addLabelIds: ["UNREAD"],
          removeLabelIds: []
        }
        await processMultipleThreads(args)
			} catch (error) {
				console.error('Error marking messages as read:', error);
        throw error
			}
    },
    getScope,
    getUserInfo: (tokens: { access_token: string; refresh_token: string }) => {
      auth.setCredentials({ ...tokens, scope: getScope() });
      return google
        .people({ version: "v1", auth })
        .people.get({ resourceName: "people/me", personFields: "names,photos,emailAddresses" });
    },
    getTokens: async <T>(code: string) => {
      try {
        const { tokens } = await auth.getToken(code);
        return { tokens } as T;
      } catch (error) {
        console.error("Error getting tokens:", error);
        throw error;
      }
    },
    generateConnectionAuthUrl: (userId: string) => {
      return auth.generateAuthUrl({
        access_type: "offline",
        scope: getScope(),
        include_granted_scopes: true,
        prompt: "consent",
        state: userId,
      });
    },
    count: async () => {
      const userLabels = await gmail.users.labels.list({
        userId: "me",
      });

      if (!userLabels.data.labels) {
        return { count: 0 };
      }
      return await Promise.all(
        userLabels.data.labels.map(async (label) => {
          return gmail.users.labels
            .get({
              userId: "me",
              id: label.id ?? undefined,
            })
            .then((res) => ({
              label: res.data.name ?? res.data.id ?? "",
              count: res.data.threadsUnread,
            }));
        }),
      );
    },
    list: async (
      folder: string,
      q: string,
      maxResults = 20,
      _labelIds: string[] = [],
      pageToken?: string,
    ) => {
      const { folder: normalizedFolder, q: normalizedQ } = normalizeSearch(folder, q ?? "");
      const labelIds = [..._labelIds];
      if (normalizedFolder) labelIds.push(normalizedFolder.toUpperCase());
      const res = await gmail.users.threads.list({
        userId: "me",
        q: normalizedQ ? normalizedQ : undefined,
        labelIds,
        maxResults,
        pageToken: pageToken ? pageToken : undefined,
      });
      const threads = await Promise.all(
        (res.data.threads || [])
          .map(async (thread) => {
            if (!thread.id) return null;
            const msg = await gmail.users.threads.get({
              userId: "me",
              id: thread.id,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });
            const labelIds = [...new Set(msg.data.messages?.flatMap(message => message.labelIds || []))];
            const message = msg.data.messages?.[0];
            const parsed = parse({ ...message, labelIds });
            return {
              ...parsed,
              body: "",
              processedHtml: "",
              blobUrl: "",
              totalReplies: msg.data.messages?.length || 0,
              threadId: thread.id,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
      );

      return { ...res.data, threads } as any;
    },
    get: async (id: string): Promise<ParsedMessage[]> => {
      const res = await gmail.users.threads.get({ userId: "me", id, format: "full" });
      if (!res.data.messages) return [];

      const messages = await Promise.all(
        res.data.messages.map(async (message) => {
          const bodyData =
            message.payload?.body?.data ||
            (message.payload?.parts ? findHtmlBody(message.payload.parts) : "") ||
            message.payload?.parts?.[0]?.body?.data ||
            "";

          if (!bodyData) {
            console.log("⚠️ Driver: No email body data found");
          } else {
            console.log("✓ Driver: Found email body data");
          }

          console.log("🔄 Driver: Processing email body...");
          const decodedBody = fromBinary(bodyData);

          console.log("✅ Driver: Email processing complete", {
            hasBody: !!bodyData,
            decodedBodyLength: decodedBody.length,
          });

          const parsedData = parse(message);

          const attachments = await Promise.all(
            message.payload?.parts
              ?.filter((part) => part.filename && part.filename.length > 0)
              ?.map(async (part) => {
                console.log("Processing attachment:", part.filename);
                const attachmentId = part.body?.attachmentId;
                if (!attachmentId) {
                  console.log("No attachment ID found for", part.filename);
                  return null;
                }

                try {
                  if (!message.id) {
                    console.error("No message ID found for attachment");
                    return null;
                  }
                  const attachmentData = await manager.getAttachment(message.id, attachmentId);
                  console.log("Fetched attachment data:", {
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body?.size,
                    dataLength: attachmentData?.length || 0,
                    hasData: !!attachmentData,
                  });
                  return {
                    filename: part.filename || "",
                    mimeType: part.mimeType || "",
                    size: Number(part.body?.size || 0),
                    attachmentId: attachmentId,
                    headers: part.headers || [],
                    body: attachmentData,
                  };
                } catch (error) {
                  console.error("Failed to fetch attachment:", part.filename, error);
                  return null;
                }
              }) || [],
          ).then((attachments) =>
            attachments.filter((a): a is NonNullable<typeof a> => a !== null),
          );

          console.log("ATTACHMENTS:", attachments);

          const fullEmailData = {
            ...parsedData,
            body: "",
            processedHtml: "",
            // blobUrl: `data:text/html;charset=utf-8,${encodeURIComponent(decodedBody)}`,
            blobUrl: "",
            decodedBody,
            attachments,
          };

          console.log("📧 Driver: Returning email data", {
            id: fullEmailData.id,
            hasBody: !!fullEmailData.body,
            hasBlobUrl: !!fullEmailData.blobUrl,
            blobUrlLength: fullEmailData.blobUrl.length,
          });

          return fullEmailData;
        }),
      );
      return messages;
    },
    create: async (data: any) => {
      const res = await gmail.users.messages.send({ userId: "me", requestBody: data });
      return res.data;
    },
    delete: async (id: string) => {
      const res = await gmail.users.messages.delete({ userId: "me", id });
      return res.data;
    },
    normalizeIds: (ids: string[]) => {
      const normalizedIds: string[] = [];
      const threadIds: string[] = [];

      for (const id of ids) {
        if (id.startsWith("thread:")) {
          threadIds.push(id.substring(7));
        } else {
          normalizedIds.push(id);
        }
      }

      return { normalizedIds, threadIds };
    },
    async modifyLabels(id: string[], options: { addLabels: string[]; removeLabels: string[] }) {
      await gmail.users.messages.batchModify({
        userId: "me",
        requestBody: {
          ids: id,
          addLabelIds: options.addLabels,
          removeLabelIds: options.removeLabels,
        },
      });
    },
    getDraft: async (draftId: string) => {
      try {
        const res = await gmail.users.drafts.get({
          userId: "me",
          id: draftId,
          format: "full",
        });

        if (!res.data) {
          throw new Error("Draft not found");
        }

        const parsedDraft = parseDraft(res.data);
        if (!parsedDraft) {
          throw new Error("Failed to parse draft");
        }

        return parsedDraft;
      } catch (error) {
        console.error("Error loading draft:", error);
        throw error;
      }
    },
    listDrafts: async (q?: string, maxResults = 20, pageToken?: string) => {
      const { q: normalizedQ } = normalizeSearch("", q ?? "");
      const res = await gmail.users.drafts.list({
        userId: "me",
        q: normalizedQ ? normalizedQ : undefined,
        maxResults,
        pageToken: pageToken ? pageToken : undefined,
      });

      const drafts = await Promise.all(
        (res.data.drafts || [])
          .map(async (draft) => {
            if (!draft.id) return null;
            const msg = await gmail.users.drafts.get({
              userId: "me",
              id: draft.id,
            });
            const message = msg.data.message;
            const parsed = parse(message as any);
            return {
              ...parsed,
              id: draft.id,
              threadId: draft.message?.id,
            };
          })
          .filter((msg): msg is NonNullable<typeof msg> => msg !== null),
      );

      return { ...res.data, drafts } as any;
    },
    createDraft: async (data: any) => {
      const mimeMessage = [
        `From: me`,
        `To: ${data.to}`,
        `Subject: ${data.subject}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        data.message,
      ].join("\n");

      const encodedMessage = Buffer.from(mimeMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const requestBody = {
        message: {
          raw: encodedMessage,
        },
      };

      let res;

      if (data.id) {
        res = await gmail.users.drafts.update({
          userId: "me",
          id: data.id,
          requestBody,
        });
      } else {
        res = await gmail.users.drafts.create({
          userId: "me",
          requestBody,
        });
      }

      return res.data;
    },
  };

  return manager;
};
