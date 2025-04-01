import * as z from "zod";

export const defaultUserSettings = {
    language: "en",
    timezone: "UTC",
    dynamicContent: false,
    externalImages: true,
    customPrompt: "",
};

export const userSettingsSchema = z.object({
    language: z.string(),
    timezone: z.string(),
    dynamicContent: z.boolean(),
    externalImages: z.boolean(),
    customPrompt: z.string(),
});

export type UserSettings = typeof defaultUserSettings;