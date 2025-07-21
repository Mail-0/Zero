import type { Message as ChatMessage } from 'ai';

export enum IncomingMessageType {
  UseChatRequest = 'cf_agent_use_chat_request',
  ChatClear = 'cf_agent_chat_clear',
  ChatMessages = 'cf_agent_chat_messages',
  ChatRequestCancel = 'cf_agent_chat_request_cancel',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export enum OutgoingMessageType {
  ChatMessages = 'cf_agent_chat_messages',
  UseChatResponse = 'cf_agent_use_chat_response',
  ChatClear = 'cf_agent_chat_clear',
  Mail_List = 'zero_mail_list_threads',
  Mail_Get = 'zero_mail_get_thread',
}

export type IncomingMessage =
  | {
      type: IncomingMessageType.UseChatRequest;
      id: string;
      init: Pick<RequestInit, 'method' | 'headers' | 'body'>;
    }
  | {
      type: IncomingMessageType.ChatClear;
    }
  | {
      type: IncomingMessageType.ChatMessages;
      messages: ChatMessage[];
    }
  | {
      type: IncomingMessageType.ChatRequestCancel;
      id: string;
    }
  | {
      type: IncomingMessageType.Mail_List;
      folder: string;
      query: string;
      maxResults: number;
      labelIds: string[];
      pageToken: string;
    }
  | {
      type: IncomingMessageType.Mail_Get;
      threadId: string;
    };

export type OutgoingMessage =
  | {
      type: OutgoingMessageType.ChatMessages;
      messages: ChatMessage[];
    }
  | {
      type: OutgoingMessageType.UseChatResponse;
      id: string;
      body: string;
      done: boolean;
    }
  | {
      type: OutgoingMessageType.ChatClear;
    }
  | {
      type: OutgoingMessageType.Mail_List;
      folder: string;
    }
  | {
      type: OutgoingMessageType.Mail_Get;
      threadId: string;
    };

export type QueueFunc = (name: string, payload: unknown) => Promise<unknown>;
