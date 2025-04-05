import * as z from "zod";

export const defaultUserSettings = {
    language: "en",
    timezone: "UTC",
    dynamicContent: false,
    externalImages: true,
    customPrompt: "",
    signature: {
        enabled: false,
        content: "",
        includeByDefault: true,
    },
};

export const userSettingsSchema = z.object({
    language: z.string(),
    timezone: z.string(),
    dynamicContent: z.boolean(),
    externalImages: z.boolean(),
    customPrompt: z.string(),
    signature: z.object({
        enabled: z.boolean(),
        content: z.string(),
        includeByDefault: z.boolean(),
    }),
});

export type UserSettings = typeof defaultUserSettings;