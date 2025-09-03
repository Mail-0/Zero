import type { ReactNode } from "react";

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags?: string[];
}

export interface UIExtensionPoint {
  location: string;
  component: ReactNode;
  priority?: number;
  pluginId?: string;
}

export interface EmailDriver {
  id: string;
  name: string;
  send: (options: EmailSendOptions) => Promise<void>;
  receive: () => Promise<Email[]>;
}

export interface AuthProvider {
  id: string;
  name: string;
  authenticate: () => Promise<AuthResult>;
}

export interface PluginHook {
  event: string;
  handler: (...args: any[]) => Promise<void> | void;
  priority?: number;
}

export interface PluginDataStorage {
  set: <T>(key: string, data: T) => Promise<void>;
  get: <T>(key: string) => Promise<T | null>;
  delete: (key: string) => Promise<void>;
}

export interface Plugin {
  metadata: PluginMetadata;
  uiExtensions?: UIExtensionPoint[];
  emailDrivers?: EmailDriver[];
  authProviders?: AuthProvider[];
  hooks?: PluginHook[];
  onActivate?: (storage: PluginDataStorage) => Promise<void> | void;
  onDeactivate?: () => Promise<void> | void;
  storage?: PluginDataStorage;
  options?: PluginOptions;
}

export interface PluginOptionField {
  type: "text" | "password" | "number" | "boolean" | "select" | "radio";
  label: string;
  description?: string;
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface PluginOptions {
  [key: string]: {
    value: any;
    field: PluginOptionField;
  };
}

export interface EmailSendOptions {
  to: string[];
  subject: string;
  content: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  content: string;
  timestamp: Date;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token?: string;
}
