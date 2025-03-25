import * as z from "zod";

export const defaultUserSettings = {
    language: "en",
    timezone: "UTC",
    dynamicContent: false,
    externalImages: true,
};

export const userSettingsSchema = z.object({
    language: z.string(),
    timezone: z.string(),
    dynamicContent: z.boolean(),
    externalImages: z.boolean(),
});

export type UserSettings = typeof defaultUserSettings;