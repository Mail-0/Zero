import { pgTable, text, timestamp, foreignKey, jsonb, unique, integer, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const mail0Verification = pgTable("mail0_verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const mail0UserHotkeys = pgTable("mail0_user_hotkeys", {
	userId: text("user_id").primaryKey().notNull(),
	shortcuts: jsonb().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_user_hotkeys_user_id_mail0_user_id_fk"
		}),
]);

export const mail0UserSettings = pgTable("mail0_user_settings", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	settings: jsonb().default({"autoRead":true,"language":"en","timezone":"UTC","categories":[{"id":"Important","icon":"Lightning","name":"Important","order":0,"isDefault":false,"searchValue":"is:important NOT is:sent NOT is:draft"},{"id":"All Mail","icon":"Mail","name":"All Mail","order":1,"isDefault":true,"searchValue":"NOT is:draft (is:inbox OR (is:sent AND to:me))"},{"id":"Personal","icon":"User","name":"Personal","order":2,"isDefault":false,"searchValue":"is:personal NOT is:sent NOT is:draft"},{"id":"Promotions","icon":"Tag","name":"Promotions","order":3,"isDefault":false,"searchValue":"is:promotions NOT is:sent NOT is:draft"},{"id":"Updates","icon":"Bell","name":"Updates","order":4,"isDefault":false,"searchValue":"is:updates NOT is:sent NOT is:draft"},{"id":"Unread","icon":"ScanEye","name":"Unread","order":5,"isDefault":false,"searchValue":"is:unread NOT is:sent NOT is:draft"}],"colorTheme":"system","isOnboarded":false,"customPrompt":"","zeroSignature":true,"dynamicContent":false,"externalImages":true,"trustedSenders":[],"imageCompression":"medium","defaultEmailAlias":""}).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_user_settings_user_id_mail0_user_id_fk"
		}),
	unique("mail0_user_settings_user_id_unique").on(table.userId),
]);

export const mail0WritingStyleMatrix = pgTable("mail0_writing_style_matrix", {
	connectionId: text().primaryKey().notNull(),
	numMessages: integer().notNull(),
	style: jsonb().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [mail0Connection.id],
			name: "mail0_writing_style_matrix_connectionId_mail0_connection_id_fk"
		}).onDelete("cascade"),
]);

export const mail0OrganizationDomain = pgTable("mail0_organization_domain", {
	id: text().primaryKey().notNull(),
	organizationId: text().notNull(),
	domain: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	verified: boolean().default(false).notNull(),
	verificationToken: text(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [mail0Organization.id],
			name: "mail0_organization_domain_organizationId_mail0_organization_id_"
		}).onDelete("cascade"),
]);

export const mail0Team = pgTable("mail0_team", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
	updatedAt: timestamp({ mode: 'string' }),
});

export const mail0Invitation = pgTable("mail0_invitation", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	inviterId: text().notNull(),
	organizationId: text().notNull(),
	teamId: text(),
	role: text().default('member').notNull(),
	status: text().default('pending').notNull(),
	expiresAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.inviterId],
			foreignColumns: [mail0User.id],
			name: "mail0_invitation_inviterId_mail0_user_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [mail0Organization.id],
			name: "mail0_invitation_organizationId_mail0_organization_id_fk"
		}),
]);

export const mail0Organization = pgTable("mail0_organization", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	logo: text(),
	metadata: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("mail0_organization_slug_unique").on(table.slug),
]);

export const mail0Member = pgTable("mail0_member", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	organizationId: text().notNull(),
	teamId: text(),
	role: text().default('member').notNull(),
	createdAt: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_member_userId_mail0_user_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [mail0Organization.id],
			name: "mail0_member_organizationId_mail0_organization_id_fk"
		}),
]);

export const mail0Account = pgTable("mail0_account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_account_user_id_mail0_user_id_fk"
		}),
]);

export const mail0Connection = pgTable("mail0_connection", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	email: text().notNull(),
	name: text(),
	picture: text(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	scope: text().notNull(),
	providerId: text("provider_id").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_connection_user_id_mail0_user_id_fk"
		}),
	unique("mail0_connection_user_id_email_unique").on(table.userId, table.email),
]);

export const mail0EarlyAccess = pgTable("mail0_early_access", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	isEarlyAccess: boolean("is_early_access").default(false).notNull(),
	hasUsedTicket: text("has_used_ticket").default('),
}, (table) => [
	unique("mail0_early_access_email_unique").on(table.email),
]);

export const mail0Jwks = pgTable("mail0_jwks", {
	id: text().primaryKey().notNull(),
	publicKey: text("public_key").notNull(),
	privateKey: text("private_key").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
});

export const mail0OauthAccessToken = pgTable("mail0_oauth_access_token", {
	id: text().primaryKey().notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	clientId: text("client_id"),
	userId: text("user_id"),
	scopes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("mail0_oauth_access_token_access_token_unique").on(table.accessToken),
	unique("mail0_oauth_access_token_refresh_token_unique").on(table.refreshToken),
]);

export const mail0OauthApplication = pgTable("mail0_oauth_application", {
	id: text().primaryKey().notNull(),
	name: text(),
	icon: text(),
	metadata: text(),
	clientId: text("client_id"),
	clientSecret: text("client_secret"),
	redirectURLs: text("redirect_u_r_ls"),
	type: text(),
	disabled: boolean(),
	userId: text("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("mail0_oauth_application_client_id_unique").on(table.clientId),
]);

export const mail0OauthConsent = pgTable("mail0_oauth_consent", {
	id: text().primaryKey().notNull(),
	clientId: text("client_id"),
	userId: text("user_id"),
	scopes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	consentGiven: boolean("consent_given"),
});

export const mail0Session = pgTable("mail0_session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	activeOrganizationId: text("active_organization_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_session_user_id_mail0_user_id_fk"
		}),
	unique("mail0_session_token_unique").on(table.token),
]);

export const mail0Summary = pgTable("mail0_summary", {
	messageId: text("message_id").primaryKey().notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	connectionId: text("connection_id").notNull(),
	saved: boolean().default(false).notNull(),
	tags: text(),
	suggestedReply: text("suggested_reply"),
});

export const mail0Note = pgTable("mail0_note", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	threadId: text("thread_id").notNull(),
	content: text().notNull(),
	color: text().default('default').notNull(),
	isPinned: boolean("is_pinned").default(false),
	order: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [mail0User.id],
			name: "mail0_note_user_id_mail0_user_id_fk"
		}).onDelete("cascade"),
]);

export const mail0User = pgTable("mail0_user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	defaultConnectionId: text("default_connection_id"),
	customPrompt: text("custom_prompt"),
	phoneNumber: text("phone_number"),
	phoneNumberVerified: boolean("phone_number_verified"),
}, (table) => [
	unique("mail0_user_email_unique").on(table.email),
	unique("mail0_user_phone_number_unique").on(table.phoneNumber),
]);
