import {
  //doorman
  pgTable,
  doublePrecision,
  //original
  pgTableCreator,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  unique,
  index,
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

export const session = createTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('session_user_id_idx').on(t.userId),
    index('session_expires_at_idx').on(t.expiresAt),
  ],
);

export const account = createTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    index('account_user_id_idx').on(t.userId),
    index('account_provider_user_id_idx').on(t.providerId, t.userId),
    index('account_expires_at_idx').on(t.accessTokenExpiresAt),
  ],
);

export const userHotkeys = createTable(
  'user_hotkeys',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    shortcuts: jsonb('shortcuts').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [index('user_hotkeys_shortcuts_idx').on(t.shortcuts)],
);

export const verification = createTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('verification_identifier_idx').on(t.identifier),
    index('verification_expires_at_idx').on(t.expiresAt),
  ],
);

export const earlyAccess = createTable(
  'early_access',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    isEarlyAccess: boolean('is_early_access').notNull().default(false),
    hasUsedTicket: text('has_used_ticket').default(''),
  },
  (t) => [index('early_access_is_early_access_idx').on(t.isEarlyAccess)],
);

export const connection = createTable(
  'connection',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
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
  },
  (t) => [
    unique().on(t.userId, t.email),
    index('connection_user_id_idx').on(t.userId),
    index('connection_expires_at_idx').on(t.expiresAt),
    index('connection_provider_id_idx').on(t.providerId),
  ],
);

export const summary = createTable(
  'summary',
  {
    messageId: text('message_id').primaryKey(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    connectionId: text('connection_id')
      .notNull()
      .references(() => connection.id, { onDelete: 'cascade' }),
    saved: boolean('saved').notNull().default(false),
    tags: text('tags'),
    suggestedReply: text('suggested_reply'),
  },
  (t) => [
    index('summary_connection_id_idx').on(t.connectionId),
    index('summary_connection_id_saved_idx').on(t.connectionId, t.saved),
    index('summary_saved_idx').on(t.saved),
  ],
);

// Testing
export const note = createTable(
  'note',
  {
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
  },
  (t) => [
    index('note_user_id_idx').on(t.userId),
    index('note_thread_id_idx').on(t.threadId),
    index('note_user_thread_idx').on(t.userId, t.threadId),
    index('note_is_pinned_idx').on(t.isPinned),
  ],
);

export const userSettings = createTable(
  'user_settings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    settings: jsonb('settings')
      .$type<typeof defaultUserSettings>()
      .notNull()
      .default(defaultUserSettings),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [index('user_settings_settings_idx').on(t.settings)],
);

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
      index('writing_style_matrix_style_idx').on(table.style),
    ];
  },
);

export const jwks = createTable(
  'jwks',
  {
    id: text('id').primaryKey(),
    publicKey: text('public_key').notNull(),
    privateKey: text('private_key').notNull(),
    createdAt: timestamp('created_at').notNull(),
  },
  (t) => [index('jwks_created_at_idx').on(t.createdAt)],
);

export const oauthApplication = createTable(
  'oauth_application',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    icon: text('icon'),
    metadata: text('metadata'),
    clientId: text('client_id').unique(),
    clientSecret: text('client_secret'),
    redirectURLs: text('redirect_u_r_ls'),
    type: text('type'),
    disabled: boolean('disabled'),
    userId: text('user_id'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('oauth_application_user_id_idx').on(t.userId),
    index('oauth_application_disabled_idx').on(t.disabled),
  ],
);

export const oauthAccessToken = createTable(
  'oauth_access_token',
  {
    id: text('id').primaryKey(),
    accessToken: text('access_token').unique(),
    refreshToken: text('refresh_token').unique(),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    clientId: text('client_id'),
    userId: text('user_id'),
    scopes: text('scopes'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
  },
  (t) => [
    index('oauth_access_token_user_id_idx').on(t.userId),
    index('oauth_access_token_client_id_idx').on(t.clientId),
    index('oauth_access_token_expires_at_idx').on(t.accessTokenExpiresAt),
  ],
);

export const oauthConsent = createTable(
  'oauth_consent',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id'),
    userId: text('user_id'),
    scopes: text('scopes'),
    createdAt: timestamp('created_at'),
    updatedAt: timestamp('updated_at'),
    consentGiven: boolean('consent_given'),
  },
  (t) => [
    index('oauth_consent_user_id_idx').on(t.userId),
    index('oauth_consent_client_id_idx').on(t.clientId),
    index('oauth_consent_given_idx').on(t.consentGiven),
  ],
);

export const emailTemplate = createTable(
  'email_template',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    subject: text('subject'),
    body: text('body'),
    to: jsonb('to'),
    cc: jsonb('cc'),
    bcc: jsonb('bcc'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_mail0_email_template_user_id').on(t.userId),
    unique('mail0_email_template_user_id_name_unique').on(t.userId, t.name),
  ],
);

//doorman
export const userProfile = pgTable(
  'user_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull().default(''),

    userType: text('user_type').notNull().default(''),

    occupation: text('occupation').notNull().default(''),

    affiliation: jsonb('affiliation').$type<string[]>().notNull().default([]),

    interest: jsonb('interest').$type<string[]>().notNull().default([]),

    importantContacts: jsonb('important_contacts')
      .$type<string[]>()
      .notNull()
      .default([]),

    categories: jsonb('categories').$type<string[]>().notNull().default([]),

    actions: jsonb('actions').$type<string[]>().notNull().default([]),

    createdAt: timestamp('created_at').notNull().defaultNow(),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('user_profile_user_id_idx').on(t.userId),
  ],
);

export const category = pgTable(
  'category',
  {
    categoryId: text('category_id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    categoryName: text('category_name').notNull(),

    promptHint: text('prompt_hint').notNull().default(''),

    enabled: boolean('enabled').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('category_user_id_idx').on(t.userId),
    index('category_enabled_idx').on(t.enabled),
  ],
);

export const actionItem = pgTable(
  'action_item',
  {
    actionItemId: text('action_item_id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),

    enabled: boolean('enabled').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('action_item_user_id_idx').on(t.userId),
    index('action_item_enabled_idx').on(t.enabled),
  ],
);

export const mailbox = pgTable(
  'mailbox',
  {
    mailboxId: text('mailbox_id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    mailboxName: text('mailbox_name').notNull(),
  },
  (t) => [
    index('mailbox_user_id_idx').on(t.userId),
  ],
);

export const email = pgTable(
  'email',
  {
    emailId: text('email_id').primaryKey(),

    date: timestamp('date'),

    from: text('from'),

    sender: text('sender'),

    receiver: text('receiver'),

    replyTo: text('reply_to'),

    to: text('to'),

    cc: text('cc'),

    bcc: text('bcc'),

    subject: text('subject'),

    body: text('body'),

    messageId: text('message_id'),

    inReplyTo: text('in_reply_to'),

    mailboxId: text('mailbox_id')
      .notNull()
      .references(() => mailbox.mailboxId, { onDelete: 'cascade' }),

    categoryId: text('category_id').references(() => category.categoryId, {
      onDelete: 'set null',
    }),

    priorityScore: doublePrecision('priority_score'),

    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index('email_mailbox_id_idx').on(t.mailboxId),
    index('email_message_id_idx').on(t.messageId),
    index('email_category_id_idx').on(t.categoryId),
  ],
);

export const mimeContent = pgTable(
  'mime_content',
  {
    id: text('id').primaryKey(),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    contentType: text('content_type'),

    charset: text('charset'),

    transferEncoding: text('transfer_encoding'),

    disposition: text('disposition'),

    filename: text('filename'),

    contentId: text('content_id'),

    rawPayload: text('raw_payload'),

    decodedText: text('decoded_text'),
  },
  (t) => [
    index('mime_content_email_id_idx').on(t.emailId),
    index('mime_content_content_id_idx').on(t.contentId),
    index('mime_content_filename_idx').on(t.filename),
  ],
);

export const analysisResult = pgTable(
  'analysis_result',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    categoryId: text('category_id').references(() => category.categoryId, {
      onDelete: 'set null',
    }),

    category: text('category'),

    priorityScore: doublePrecision('priority_score'),

    suggestedActions: text('suggested_actions'),

    reason: text('reason'),

    source: text('source').notNull().default('llm'),

    rawResult: jsonb('raw_result').$type<Record<string, unknown>>(),

    hallucinationChecked: boolean('hallucination_checked')
      .notNull()
      .default(false),

    analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),
  },
  (t) => [
    index('analysis_result_user_id_idx').on(t.userId),
    index('analysis_result_email_id_idx').on(t.emailId),
    index('analysis_result_category_id_idx').on(t.categoryId),
    index('analysis_result_source_idx').on(t.source),
  ],
);

export const feedbackData = pgTable(
  'feedback_data',
  {
    id: text('id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    analysisId: text('analysis_id').references(() => analysisResult.id, {
      onDelete: 'cascade',
    }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    targetType: text('target_type').notNull(),

    rating: text('rating'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('feedback_data_user_id_idx').on(t.userId),
    index('feedback_data_analysis_id_idx').on(t.analysisId),
    index('feedback_data_email_id_idx').on(t.emailId),
    index('feedback_data_target_type_idx').on(t.targetType),
  ],
);

export const promptContext = pgTable(
  'prompt_context',
  {
    promptId: text('prompt_id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    promptData: text('prompt_data').notNull(),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),

    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('prompt_context_user_id_idx').on(t.userId),
    index('prompt_context_active_idx').on(t.isActive),
  ],
);

export const priorityScore = pgTable(
  'priority_score',
  {
    id: text('id').primaryKey(),

    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisResult.id, { onDelete: 'cascade' }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    score: doublePrecision('score').notNull(),
  },
  (t) => [
    index('priority_score_analysis_id_idx').on(t.analysisId),
    index('priority_score_email_id_idx').on(t.emailId),
  ],
);

export const actionSuggestion = pgTable(
  'action_suggestion',
  {
    id: text('id').primaryKey(),

    analysisId: text('analysis_id')
      .notNull()
      .references(() => analysisResult.id, { onDelete: 'cascade' }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    actionItemId: text('action_item_id').references(() => actionItem.actionItemId, {
      onDelete: 'set null',
    }),

    actionLabel: text('action_label').notNull(),

    reason: text('reason'),
  },
  (t) => [
    index('action_suggestion_analysis_id_idx').on(t.analysisId),
    index('action_suggestion_email_id_idx').on(t.emailId),
    index('action_suggestion_action_item_id_idx').on(t.actionItemId),
  ],
);

export const correctionRecord = pgTable(
  'correction_record',
  {
    correctionId: text('correction_id').primaryKey(),

    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    correctedCategoryId: text('corrected_category_id').references(
      () => category.categoryId,
      { onDelete: 'set null' },
    ),

    correctedCategory: text('corrected_category').notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('correction_record_user_id_idx').on(t.userId),
    index('correction_record_email_id_idx').on(t.emailId),
    index('correction_record_corrected_category_id_idx').on(t.correctedCategoryId),
  ],
);

export const hallucinationMitigationLog = pgTable(
  'hallucination_mitigation_log',
  {
    taskId: text('task_id').primaryKey(),

    analysisId: text('analysis_id').references(() => analysisResult.id, {
      onDelete: 'cascade',
    }),

    emailId: text('email_id')
      .notNull()
      .references(() => email.emailId, { onDelete: 'cascade' }),

    rawOutput: jsonb('raw_output').$type<Record<string, unknown>>(),

    status: text('status').notNull(),

    correctedOutput: jsonb('corrected_output').$type<Record<string, unknown>>(),

    reprocessCount: integer('reprocess_count').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('hallucination_mitigation_log_analysis_id_idx').on(t.analysisId),
    index('hallucination_mitigation_log_email_id_idx').on(t.emailId),
    index('hallucination_mitigation_log_status_idx').on(t.status),
  ],
);