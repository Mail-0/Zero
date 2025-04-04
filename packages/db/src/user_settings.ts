import * as z from "zod";

export const generalSettingsSchema = z.object({
    language: z.string().default("en"),
    timezone: z.string().default("UTC"),
    dynamicContent: z.boolean().default(false),
    externalImages: z.boolean().default(true),
    customPrompt: z.string().default("")
});

export const securitySettingsSchema = z.object({
    twoFactorAuth: z.boolean().default(false),
    loginNotifications: z.boolean().default(true),
});

export const appearanceSettingsSchema = z.object({
    inboxType: z.enum(['default', 'important', 'unread']).default('default')
});

export const notificationSettingsSchema = z.object({
    newMailNotifications: z.enum(['none', 'important', 'all']).default('all'),
    marketingCommunications: z.boolean().default(false),
});

export const userSettingsSchema = z.object({
    general: generalSettingsSchema,
    security: securitySettingsSchema,
    appearance: appearanceSettingsSchema,
    notification: notificationSettingsSchema,
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const defaultUserSettings: UserSettings = {
    general: generalSettingsSchema.parse({}),
    security: securitySettingsSchema.parse({}),
    appearance: appearanceSettingsSchema.parse({}),
    notification: notificationSettingsSchema.parse({}),
};
