import * as z from "zod";

export const defaultUserSettings = {
    language: "en",
    timezone: "UTC",
    dynamicContent: false,
    externalImages: true,
    customPrompt: "",
    trustedSenders: [],
    isOnboarded: false
} satisfies UserSettings;

export const userSettingsSchema = z.object({
    language: z.string(),
    timezone: z.string(),
    dynamicContent: z.boolean(),
    externalImages: z.boolean(),
    customPrompt: z.string(),
    isOnboarded: z.boolean().optional(),
    trustedSenders: z.string().array().optional(),
});

export type UserSettings = z.infer<typeof userSettingsSchema>