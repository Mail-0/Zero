import { getZeroDB } from './server-utils';
import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';

type EmailTemplate = {
  id: string;
  userId: string;
  name: string;
  subject: string | null;
  body: string | null;
  to: string[] | null;
  cc: string[] | null;
  bcc: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

export class TemplatesManager {
  async listTemplates(userId: string) {
    const db = await getZeroDB(userId);
    return await db.listEmailTemplates();
  }

  async createTemplate(
    userId: string,
    payload: {
      id?: string;
      name: string;
      subject?: string | null;
      body?: string | null;
      to?: string[] | null;
      cc?: string[] | null;
      bcc?: string[] | null;
    },
  ) {
    if (payload.name.length > 100) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template name must be at most 100 characters',
      });
    }
    
    if (payload.subject && payload.subject.length > 500) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template subject must be at most 500 characters',
      });
    }
    
    if (payload.body && payload.body.length > 50000) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Template body must be at most 50,000 characters',
      });
    }

    const db = await getZeroDB(userId);
    
    const existingTemplates = (await db.listEmailTemplates()) as EmailTemplate[];
    const nameExists = existingTemplates.some((template: EmailTemplate) => 
      template.name.toLowerCase() === payload.name.toLowerCase()
    );
    
    if (nameExists) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `A template named "${payload.name}" already exists. Please choose a different name.`,
      });
    }
    
    const id = payload.id ?? randomUUID();
    const [template] = await db.createEmailTemplate({
      id,
      name: payload.name,
      subject: payload.subject ?? null,
      body: payload.body ?? null,
      to: payload.to ?? null,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
    }) as EmailTemplate[];
    return template;
  }

  async deleteTemplate(userId: string, templateId: string) {
    const db = await getZeroDB(userId);
    await db.deleteEmailTemplate(templateId);
    return true;
  }
} 