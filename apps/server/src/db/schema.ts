import {
  pgTableCreator,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  unique,
} from 'drizzle-orm/pg-core';
import { defaultUserSettings } from '../lib/schemas';

export const createTable = pgTableCreator((name) => `mail0_${name}`);

export const user = createTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  defaultConnectionId: text('default_connection_id'),
  customPrompt: text('custom_prompt'),
  phoneNumber: text('phone_number').unique(),
  phoneNumberVerified: boolean('phone_number_verified'),
});

export const session = createTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
});

export const account = createTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const userHotkeys = createTable('user_hotkeys', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  shortcuts: jsonb('shortcuts').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = createTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const earlyAccess = createTable('early_access', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  isEarlyAccess: boolean('is_early_access').notNull().default(false),
  hasUsedTicket: text('has_used_ticket').default(''),
});

export const theme = createTable('theme', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Color settings
  colors: jsonb('colors').notNull().$type<{
    primary: string;
    primaryForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    border: string;
    input: string;
    ring: string;
    success?: string;
    warning?: string;
    error?: string;
  }>(),
  // Font settings
  fonts: jsonb('fonts').notNull().$type<{
    body: string;
    heading: string;
    mono: string;
  }>(),
  // Spacing system
  spacing: jsonb('spacing').notNull().$type<{
    base: string;
    section: string;
    card: string;
    button: string;
  }>(),
  // Shadow system
  shadows: jsonb('shadows').notNull().$type<{
    base: string;
    card: string;
    button: string;
  }>(),
  // Border radius system
  radius: jsonb('radius').notNull().$type<{
    base: string;
    button: string;
    card: string;
    input: string;
  }>(),
  // Additional theme settings
  isPublic: boolean('is_public').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdate(() => new Date()),
});

export const connection = createTable(
  'connection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    email: text('email').notNull(),
    name: text('name'),
    picture: text('picture'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    scope: text('scope').notNull(),
    providerId: text('provider_id').$type<'google' | 'microsoft'>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    themeId: text('theme_id').references(() => theme.id, { onDelete: 'set null' }),
  },
  (t) => [unique().on(t.userId, t.email)],
);

export const userFavoriteThemes = createTable(
  'user_favorite_themes',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    themeId: text('theme_id')
      .notNull()
      .references(() => theme.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.themeId] }),
  })
);

export const summary = createTable('summary', {
  messageId: text('message_id').primaryKey(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  connectionId: text('connection_id').notNull(),
  saved: boolean('saved').notNull().default(false),
  tags: text('tags'),
  suggestedReply: text('suggested_reply'),
});

// Testing
export const note = createTable('note', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').notNull(),
  content: text('content').notNull(),
  color: text('color').notNull().default('default'),
  isPinned: boolean('is_pinned').default(false),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const userSettings = createTable('user_settings', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id)
    .unique(),
  settings: jsonb('settings').notNull().default(defaultUserSettings),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const writingStyleMatrix = createTable(
  'writing_style_matrix',
  {
    connectionId: text()
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    numMessages: integer().notNull(),
    // TODO: way too much pain to get this type to work,
    // revisit later
    style: jsonb().$type<unknown>().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return [
      primaryKey({
        columns: [table.connectionId],
      }),
    ];
  },
);

export const jwks = createTable('jwks', {
  id: text('id').primaryKey(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  createdAt: timestamp('created_at').notNull(),
});
