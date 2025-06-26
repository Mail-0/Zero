import { relations } from "drizzle-orm/relations";
import { mail0User, mail0UserHotkeys, mail0UserSettings, mail0Connection, mail0WritingStyleMatrix, mail0Organization, mail0OrganizationDomain, mail0Invitation, mail0Member, mail0Account, mail0Session, mail0Note } from "./schema";

export const mail0UserHotkeysRelations = relations(mail0UserHotkeys, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0UserHotkeys.userId],
		references: [mail0User.id]
	}),
}));

export const mail0UserRelations = relations(mail0User, ({many}) => ({
	mail0UserHotkeys: many(mail0UserHotkeys),
	mail0UserSettings: many(mail0UserSettings),
	mail0Invitations: many(mail0Invitation),
	mail0Members: many(mail0Member),
	mail0Accounts: many(mail0Account),
	mail0Connections: many(mail0Connection),
	mail0Sessions: many(mail0Session),
	mail0Notes: many(mail0Note),
}));

export const mail0UserSettingsRelations = relations(mail0UserSettings, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0UserSettings.userId],
		references: [mail0User.id]
	}),
}));

export const mail0WritingStyleMatrixRelations = relations(mail0WritingStyleMatrix, ({one}) => ({
	mail0Connection: one(mail0Connection, {
		fields: [mail0WritingStyleMatrix.connectionId],
		references: [mail0Connection.id]
	}),
}));

export const mail0ConnectionRelations = relations(mail0Connection, ({one, many}) => ({
	mail0WritingStyleMatrices: many(mail0WritingStyleMatrix),
	mail0User: one(mail0User, {
		fields: [mail0Connection.userId],
		references: [mail0User.id]
	}),
}));

export const mail0OrganizationDomainRelations = relations(mail0OrganizationDomain, ({one}) => ({
	mail0Organization: one(mail0Organization, {
		fields: [mail0OrganizationDomain.organizationId],
		references: [mail0Organization.id]
	}),
}));

export const mail0OrganizationRelations = relations(mail0Organization, ({many}) => ({
	mail0OrganizationDomains: many(mail0OrganizationDomain),
	mail0Invitations: many(mail0Invitation),
	mail0Members: many(mail0Member),
}));

export const mail0InvitationRelations = relations(mail0Invitation, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0Invitation.inviterId],
		references: [mail0User.id]
	}),
	mail0Organization: one(mail0Organization, {
		fields: [mail0Invitation.organizationId],
		references: [mail0Organization.id]
	}),
}));

export const mail0MemberRelations = relations(mail0Member, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0Member.userId],
		references: [mail0User.id]
	}),
	mail0Organization: one(mail0Organization, {
		fields: [mail0Member.organizationId],
		references: [mail0Organization.id]
	}),
}));

export const mail0AccountRelations = relations(mail0Account, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0Account.userId],
		references: [mail0User.id]
	}),
}));

export const mail0SessionRelations = relations(mail0Session, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0Session.userId],
		references: [mail0User.id]
	}),
}));

export const mail0NoteRelations = relations(mail0Note, ({one}) => ({
	mail0User: one(mail0User, {
		fields: [mail0Note.userId],
		references: [mail0User.id]
	}),
}));