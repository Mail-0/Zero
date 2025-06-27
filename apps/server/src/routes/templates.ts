import { Hono } from 'hono';
import { createDb } from '../db';
import { mail0_templates } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCookie } from 'hono/cookie';
import type { Context } from 'hono';


const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}


const { db } = createDb(DATABASE_URL);

const templatesRoute = new Hono();


const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  subject: z.string().max(500, 'Subject too long').optional().default(''),
  content: z.string().min(1, 'Content is required'),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
  subject: z.string().max(500, 'Subject too long').optional(),
  content: z.string().min(1, 'Content is required').optional(),
});

const templateIdSchema = z.string().uuid('Invalid template ID format');


async function validateSession(c: Context): Promise<string | null> {
  try {
    
    const sessionToken = getCookie(c, 'better-auth.session_token') || 
                         getCookie(c, 'session_token') ||
                         getCookie(c, 'auth_session');
    
    if (!sessionToken) {
      return null;
    }

    
    const authUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${authUrl}/api/auth/session`, {
      method: 'GET',
      headers: {
        'Cookie': `better-auth.session_token=${sessionToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    
   
    if (data && typeof data === 'object' && 'user' in data) {
      const userData = (data as any).user;
      if (userData && typeof userData === 'object' && 'id' in userData && typeof userData.id === 'string') {
        return userData.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}


const requireAuth = async (c: Context, next: () => Promise<void>) => {
  try {
    
    const userId = await validateSession(c);
    
    if (userId) {
      c.set('userId', userId);
      await next();
      return;
    }

    
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
     
      const authUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
      const response = await fetch(`${authUrl}/api/auth/session`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: unknown = await response.json();
        if (data && typeof data === 'object' && 'user' in data) {
          const userData = (data as any).user;
          if (userData && typeof userData === 'object' && 'id' in userData && typeof userData.id === 'string') {
            c.set('userId', userData.id);
            await next();
            return;
          }
        }
      }
    }

    
    if (process.env.NODE_ENV === 'development') {
      const devUserId = c.req.header('x-user-id');
      if (devUserId) {
        console.warn('Using x-user-id header for auth - DEVELOPMENT ONLY!');
        c.set('userId', devUserId);
        await next();
        return;
      }
    }

    return c.json({ 
      error: 'Authentication required',
      success: false,
      message: 'Please log in to access this resource'
    }, 401);
  } catch (error) {
    console.error('Authentication error:', error);
    return c.json({ 
      error: 'Authentication failed',
      success: false 
    }, 401);
  }
};


templatesRoute.use('*', requireAuth);


templatesRoute.get('/', async (c: Context) => {
  try {
    const userId = c.get('userId') as string;
    
    const templates = await db
      .select({
        id: mail0_templates.id,
        name: mail0_templates.name,
        subject: mail0_templates.subject,
        content: mail0_templates.content,
        createdAt: mail0_templates.createdAt,
        updatedAt: mail0_templates.updatedAt,
      })
      .from(mail0_templates)
      .where(eq(mail0_templates.userId, userId))
      .orderBy(mail0_templates.createdAt);
    
    return c.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return c.json({ 
      error: 'Failed to fetch templates',
      success: false 
    }, 500);
  }
});


templatesRoute.get('/:id', async (c: Context) => {
  try {
    const userId = c.get('userId') as string;
    const templateId = c.req.param('id');
    
    
    const validatedId = templateIdSchema.parse(templateId);
    
    const template = await db
      .select()
      .from(mail0_templates)
      .where(
        and(
          eq(mail0_templates.id, validatedId),
          eq(mail0_templates.userId, userId)
        )
      )
      .limit(1);
    
    if (template.length === 0) {
      return c.json({ 
        error: 'Template not found',
        success: false,
        message: 'Template does not exist or you do not have permission to access it'
      }, 404);
    }
    
    return c.json({
      success: true,
      data: template[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Invalid template ID format',
        success: false,
        details: error.errors 
      }, 400);
    }
    
    console.error('Failed to fetch template:', error);
    return c.json({ 
      error: 'Failed to fetch template',
      success: false 
    }, 500);
  }
});


templatesRoute.post('/', async (c: Context) => {
  try {
    const userId = c.get('userId') as string;
    const body = await c.req.json();
    
    
    const validatedData = createTemplateSchema.parse(body);
    
    const newTemplate = await db
      .insert(mail0_templates)
      .values({
        id: crypto.randomUUID(),
        userId,
        name: validatedData.name,
        subject: validatedData.subject,
        content: validatedData.content,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return c.json({
      success: true,
      data: newTemplate[0],
      message: 'Template created successfully',
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation failed',
        success: false,
        details: error.errors,
        message: 'Please check your input and try again'
      }, 400);
    }
    
    
    if (error instanceof Error && error.message.includes('unique')) {
      return c.json({
        error: 'Template name already exists',
        success: false,
        message: 'A template with this name already exists. Please choose a different name.'
      }, 409);
    }
    
    console.error('Failed to create template:', error);
    return c.json({ 
      error: 'Failed to create template',
      success: false,
      message: 'An unexpected error occurred while creating the template'
    }, 500);
  }
});


templatesRoute.put('/:id', async (c: Context) => {
  try {
    const userId = c.get('userId') as string;
    const templateId = c.req.param('id');
    const body = await c.req.json();
    
    
    const validatedId = templateIdSchema.parse(templateId);
    const validatedData = updateTemplateSchema.parse(body);
    
    
    const existingTemplate = await db
      .select({ id: mail0_templates.id })
      .from(mail0_templates)
      .where(
        and(
          eq(mail0_templates.id, validatedId),
          eq(mail0_templates.userId, userId)
        )
      )
      .limit(1);
    
    if (existingTemplate.length === 0) {
      return c.json({ 
        error: 'Template not found',
        success: false,
        message: 'Template does not exist or you do not have permission to modify it'
      }, 404);
    }
    
    
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };
    
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.subject !== undefined) updateData.subject = validatedData.subject;
    if (validatedData.content !== undefined) updateData.content = validatedData.content;
    
    const updated = await db
      .update(mail0_templates)
      .set(updateData)
      .where(
        and(
          eq(mail0_templates.id, validatedId),
          eq(mail0_templates.userId, userId)
        )
      )
      .returning();
    
    return c.json({
      success: true,
      data: updated[0],
      message: 'Template updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Validation failed',
        success: false,
        details: error.errors,
        message: 'Please check your input and try again'
      }, 400);
    }
    
    
    if (error instanceof Error && error.message.includes('unique')) {
      return c.json({
        error: 'Template name already exists',
        success: false,
        message: 'A template with this name already exists. Please choose a different name.'
      }, 409);
    }
    
    console.error('Failed to update template:', error);
    return c.json({ 
      error: 'Failed to update template',
      success: false,
      message: 'An unexpected error occurred while updating the template'
    }, 500);
  }
});


templatesRoute.delete('/:id', async (c: Context) => {
  try {
    const userId = c.get('userId') as string;
    const templateId = c.req.param('id');
    
    
    const validatedId = templateIdSchema.parse(templateId);
    
    
    const existingTemplate = await db
      .select({ id: mail0_templates.id, name: mail0_templates.name })
      .from(mail0_templates)
      .where(
        and(
          eq(mail0_templates.id, validatedId),
          eq(mail0_templates.userId, userId)
        )
      )
      .limit(1);
    
    if (existingTemplate.length === 0) {
      return c.json({ 
        error: 'Template not found',
        success: false,
        message: 'Template does not exist or you do not have permission to delete it'
      }, 404);
    }
    
    await db
      .delete(mail0_templates)
      .where(
        and(
          eq(mail0_templates.id, validatedId),
          eq(mail0_templates.userId, userId)
        )
      );
    
    return c.json({ 
      success: true,
      message: `Template "${existingTemplate[0].name}" deleted successfully`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ 
        error: 'Invalid template ID format',
        success: false,
        details: error.errors 
      }, 400);
    }
    
    console.error('Failed to delete template:', error);
    return c.json({ 
      error: 'Failed to delete template',
      success: false,
      message: 'An unexpected error occurred while deleting the template'
    }, 500);
  }
});

export default templatesRoute;