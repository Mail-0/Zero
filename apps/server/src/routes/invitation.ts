import { Hono } from 'hono';
import { createDb } from '../db';
import { invitation } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import type { HonoContext } from '../ctx';
import { member } from '../db/schema';
import { nanoid } from 'nanoid';

const invitationRouter = new Hono<HonoContext>();

// Fetch invitations with optional query filters: organizationId and status
invitationRouter.get('/', async (c) => {
  const { db, conn } = createDb(c.env.HYPERDRIVE.connectionString);
  try {
    const { organizationId, status } = c.req.query();

    let whereClause;
    if (organizationId && status) {
      whereClause = and(eq(invitation.organizationId, organizationId), eq(invitation.status, status));
    } else if (organizationId) {
      whereClause = eq(invitation.organizationId, organizationId);
    } else if (status) {
      whereClause = eq(invitation.status, status);
    }

    let invites;
    if (whereClause) {
      invites = await db.select().from(invitation).where(whereClause);
    } else {
      invites = await db.select().from(invitation);
    }
    return c.json({ invitations: invites });
  } finally {
    await conn.end();
  }
});

// Accept an invitation
invitationRouter.post('/:id/accept', async (c) => {
  const { db, conn } = createDb(c.env.HYPERDRIVE.connectionString);
  try {
    const id = c.req.param('id');
    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
    const userId = sessionUser.id;
    const [inv] = await db.select().from(invitation).where(eq(invitation.id, id));
    if (!inv) return c.json({ error: 'Invitation not found' }, 404);
    // Insert member if not exists
    const existing = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, inv.organizationId)));
    if (existing.length === 0) {
      await db.insert(member).values({
        id: nanoid(),
        userId,
        organizationId: inv.organizationId,
        role: inv.role,
        teamId: inv.teamId,
        createdAt: new Date(),
      });
    }
    await db.update(invitation).set({ status: 'accepted' }).where(eq(invitation.id, id));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Decline an invitation
invitationRouter.post('/:id/decline', async (c) => {
  const { db, conn } = createDb(c.env.HYPERDRIVE.connectionString);
  try {
    const id = c.req.param('id');
    await db.update(invitation).set({ status: 'declined' }).where(eq(invitation.id, id));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Cancel/Delete an invitation
invitationRouter.delete('/:id', async (c) => {
  const { db, conn } = createDb(c.env.HYPERDRIVE.connectionString);
  try {
    const id = c.req.param('id');
    await db.delete(invitation).where(eq(invitation.id, id));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

export { invitationRouter }; 