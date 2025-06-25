import { z } from 'zod';

export const serializedFileSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number(),
  lastModified: z.number(),
  base64: z.string(),
});

export const deserializeFiles = async (serializedFiles: z.infer<typeof serializedFileSchema>[]) => {
  return await Promise.all(
    serializedFiles.map((data) => {
      const file = Buffer.from(data.base64, 'base64');
      const blob = new Blob([file], { type: data.type });
      const newFile = new File([blob], data.name, {
        type: data.type,
        lastModified: data.lastModified,
      });
      return newFile;
    }),
  );
};

export const createDraftData = z.object({
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  message: z.string(),
  attachments: z.array(serializedFileSchema).transform(deserializeFiles).optional(),
  id: z.string().nullable(),
  threadId: z.string().nullable(),
  fromEmail: z.string().nullable(),
});

export type CreateDraftData = z.infer<typeof createDraftData>;

export const mailCategorySchema = z.object({
  id: z.enum(['Important', 'All Mail', 'Personal', 'Promotions', 'Updates', 'Unread']),
  name: z.string(),
  searchValue: z.string(),
  order: z.number().int(),
  icon: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export type MailCategory = z.infer<typeof mailCategorySchema>;

export const defaultMailCategories: MailCategory[] = [
  {
    id: 'Important',
    name: 'Important',
    searchValue: 'is:important NOT is:sent NOT is:draft',
    order: 0,
    icon: 'Lightning',
    isDefault: false,
  },
  {
    id: 'All Mail',
    name: 'All Mail',
    searchValue: 'NOT is:draft (is:inbox OR (is:sent AND to:me))',
    order: 1,
    icon: 'Mail',
    isDefault: true,
  },
  {
    id: 'Personal',
    name: 'Personal',
    searchValue: 'is:personal NOT is:sent NOT is:draft',
    order: 2,
    icon: 'User',
    isDefault: false,
  },
  {
    id: 'Promotions',
    name: 'Promotions',
    searchValue: 'is:promotions NOT is:sent NOT is:draft',
    order: 3,
    icon: 'Tag',
    isDefault: false,
  },
  {
    id: 'Updates',
    name: 'Updates',
    searchValue: 'is:updates NOT is:sent NOT is:draft',
    order: 4,
    icon: 'Bell',
    isDefault: false,
  },
  {
    id: 'Unread',
    name: 'Unread',
    searchValue: 'is:unread NOT is:sent NOT is:draft',
    order: 5,
    icon: 'ScanEye',
    isDefault: false,
  },
];

const categoriesSchema = z.array(mailCategorySchema).superRefine((cats, ctx) => {
  const orders = cats.map((c) => c.order);
  if (new Set(orders).size !== orders.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each mail category must have a unique order number',
    });
  }

  const defaultCount = cats.filter((c) => c.isDefault).length;
  if (defaultCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one mail category must be set as default',
    });
  }
});

export const userSettingsSchema = z.object({
  language: z.string(),
  timezone: z.string(),
  dynamicContent: z.boolean().optional(),
  externalImages: z.boolean(),
  customPrompt: z.string(),
  isOnboarded: z.boolean().optional(),
  trustedSenders: z.string().array().optional(),
  colorTheme: z.enum(['light', 'dark', 'system']).default('system'),
  zeroSignature: z.boolean().default(true),
  categories: categoriesSchema.optional(),
  defaultEmailAlias: z.string().optional(),
  autoRead: z.boolean().default(true),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const defaultUserSettings: UserSettings = {
  language: 'en',
  timezone: 'UTC',
  dynamicContent: false,
  externalImages: true,
  customPrompt: '',
  trustedSenders: [],
  isOnboarded: false,
  colorTheme: 'system',
  zeroSignature: true,
  autoRead: true,
  defaultEmailAlias: '',
  categories: defaultMailCategories,
};
