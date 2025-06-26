import { Hono } from 'hono';
import { getZeroDB } from '../lib/server-utils';
import { organizationDomain, organization, member, team, organizationConnection, connection as connectionTable, user } from '../db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import dns from 'node:dns/promises';
import type { HonoContext } from '../ctx';
import { createDb } from '../db';


const orgRouter = new Hono<HonoContext>();

// Verify domain ownership (without organization ID)
orgRouter.post('/verify-domain', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const { domain, verificationToken: providedToken } = await c.req.json();
    if (!domain) return c.json({ error: 'Domain required' }, 400);
  
    // Use provided token or generate a new one
    const verificationToken = providedToken || nanoid();
  
    // Check DNS TXT record
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const expected = `zero-verification=${verificationToken}`;
      const found = txtRecords.some((arr) => arr.join('').trim() === expected);
  
      if (found) {
        return c.json({
          success: true,
          verified: true,
          message: 'Domain verified successfully!',
          verificationToken
        });
      } else {
        return c.json({
          success: false,
          verified: false,
          message: `Please add this TXT record to your DNS: zero-verification=${verificationToken}`,
          verificationToken
        });
      }
    } catch (err) {
      return c.json({
        success: false,
        verified: false,
        error: 'DNS lookup failed',
        message: `Please add this TXT record to your DNS: zero-verification=${verificationToken}`,
        verificationToken,
        details: String(err)
      });
    }
  } finally {
    await conn.end();
  }
});

// Get allowed domains
orgRouter.get('/:id/domains', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const domains = await db
      .select()
      .from(organizationDomain)
      .where(eq(organizationDomain.organizationId, orgId));
    // Return all relevant info for verification
    return c.json({
      domains: domains.map((d: any) => ({
        domain: d.domain,
        verified: d.verified,
        verificationToken: d.verificationToken,
      })),
    });
  } finally {
    await conn.end();
  }
});

// Add a domain
orgRouter.post('/:id/domains', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { domain } = await c.req.json();
    if (!domain) return c.json({ error: 'Domain required' }, 400);
    const sessionUser = c.get('sessionUser');
  if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
  const db = getZeroDB(sessionUser.id);
  const verificationToken = nanoid();
    await db.insertOrganizationDomain({
      id: nanoid(),
      organizationId: orgId,
      domain,
      createdAt: new Date(),
      verified: false,
      verificationToken,
    });
    return c.json({ success: true, verificationToken });
  } finally {
    await conn.end();
  }
});

// Remove a domain
orgRouter.delete('/:id/domains', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { domain } = await c.req.json();
    if (!domain) return c.json({ error: 'Domain required' }, 400);
    await db.delete(organizationDomain)
      .where(and(eq(organizationDomain.organizationId, orgId), eq(organizationDomain.domain, domain)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Verify a domain via DNS TXT record
orgRouter.post('/:id/domains/verify', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { domain } = await c.req.json();
    if (!domain) return c.json({ error: 'Domain required' }, 400);
    // Get the domain row
    const [row] = await db
      .select()
      .from(organizationDomain)
      .where(and(eq(organizationDomain.organizationId, orgId), eq(organizationDomain.domain, domain)));
    if (!row) return c.json({ error: 'Domain not found' }, 404);
    if (row.verified) return c.json({ success: true, verified: true });
    // Check DNS TXT record
    try {
      const txtRecords = await dns.resolveTxt(domain);
      const expected = `zero-verification=${row.verificationToken}`;
      const found = txtRecords.some((arr) => arr.join('').trim() === expected);
      if (found) {
        await db
          .update(organizationDomain)
          .set({ verified: true })
          .where(and(eq(organizationDomain.organizationId, orgId), eq(organizationDomain.domain, domain)));
        return c.json({ success: true, verified: true });
      } else {
        return c.json({ success: false, verified: false, message: 'TXT record not found' });
      }
    } catch (err) {
      return c.json({ success: false, error: 'DNS lookup failed', details: String(err) });
    }
  } finally {
    await conn.end();
  }
});

// Invite a member to the organization
orgRouter.post('/:id/invite', async (c) => {
  const orgId = c.req.param('id');
  const { email, role = 'member', teamId } = await c.req.json();
  // Get the inviter's user ID from the session
  const inviterId = c.get('sessionUser')?.id;
  if (!inviterId) return c.json({ error: 'Unauthorized' }, 401);
  const db = getZeroDB(inviterId);
  if (!email) return c.json({ error: 'Email required' }, 400);

  try {
    // our logic, blank for now pending better-auth plugin to work.
    return c.json({ success: true });
  } catch (err) {
    console.error('Failed to invite member:', err);
    return c.json({ error: 'Failed to invite member', details: String(err) }, 500);
  }
});

// Organisation CRUD
orgRouter.get('/', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgs = await db.select().from(organization);
    return c.json({ organizations: orgs });
  } finally {
    await conn.end();
  }
});

orgRouter.post('/', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const { name, slug, logo, metadata } = await c.req.json();
    if (!name) return c.json({ error: 'Name required' }, 400);
    const id = nanoid();
    const finalSlug =
      slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    await db.insert(organization).values({
      id,
      name,
      slug: finalSlug,
      logo,
      metadata,
      createdAt: new Date(),
    });
    return c.json({ success: true, organizationId: id });
  } finally {
    await conn.end();
  }
});

orgRouter.get('/:id', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
    if (!org) return c.json({ error: 'Organization not found' }, 404);
    return c.json({ organization: org });
  } finally {
    await conn.end();
  }
});

orgRouter.patch('/:id', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { name, slug, logo, metadata } = await c.req.json();
    await db
      .update(organization)
      .set({ name, slug, logo, metadata })
      .where(eq(organization.id, orgId));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Delete organization (owner only)
orgRouter.delete('/:id', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);

    const owner = await isOwner(db, orgId, sessionUser.id);
    if (!owner) return c.json({ error: 'Only owners can delete organization' }, 403);

    await db.delete(organization).where(eq(organization.id, orgId));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Leave organization shortcut
orgRouter.post('/:id/leave', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  try {
    const orgId = c.req.param('id');
    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);

    await db
      .delete(member)
      .where(and(eq(member.userId, sessionUser.id), eq(member.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Members CRUD
// List members (deduplicated)
orgRouter.get('/:id/members', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const rows = await db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        teamId: member.teamId,
        name: user.name,
        email: user.email,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, orgId));
    // Deduplicate by userId (in case of historical duplicates) keep first occurrence
    const rolePriority: Record<string, number> = { owner: 3, admin: 2, member: 1 };
    const map = new Map<string, typeof rows[0]>();
    for (const r of rows) {
      const existing = map.get(r.userId);
      if (!existing || rolePriority[r.role] > rolePriority[existing.role]) {
        map.set(r.userId, r);
      }
    }
    const deduped = Array.from(map.values());
    return c.json({ members: deduped });
  } finally {
    await conn.end();
  }
});

// Add member manually (owner only) or update existing
orgRouter.post('/:id/members', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { userId, role = 'member', teamId } = await c.req.json();
    if (!userId) return c.json({ error: 'userId required' }, 400);

    // Authorization: only owners or admins can add members
    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
    const [self] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, sessionUser.id)));
    if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
      return c.json({ error: 'Only owners or admins can add members' }, 403);
    }

    if (self.role === 'admin' && role !== 'member') {
      return c.json({ error: 'Admins can only add members with role "member"' }, 403);
    }

    // Upsert logic
    const existing = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)));
    if (existing.length === 0) {
      await db.insert(member).values({
        id: nanoid(),
        userId,
        organizationId: orgId,
        role,
        teamId,
        createdAt: new Date(),
      });
    } else {
      await db
        .update(member)
        .set({ role, teamId })
        .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)));
    }
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

orgRouter.patch('/:id/members/:memberId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const memberId = c.req.param('memberId');
    const { role, teamId } = await c.req.json();

    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
    const [self] = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, sessionUser.id)));
    if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
      return c.json({ error: 'Only owners or admins can update members' }, 403);
    }

    // fetch target before updating to enforce rules for admins
    const [target] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));
    if (!target) return c.json({ error: 'Member not found' }, 404);

    if (self.role === 'admin') {
      if (target.role !== 'member' || role !== 'member') {
        return c.json({ error: 'Admins can only modify members' }, 403);
      }
    }

    await db
      .update(member)
      .set({ role, teamId })
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Remove member (owner) or leave org (self)
orgRouter.delete('/:id/members/:memberId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const memberId = c.req.param('memberId');

    const sessionUser = c.get('sessionUser');
    if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);

    // fetch target member and self role
    const [target] = await db
      .select()
      .from(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));
    if (!target) return c.json({ error: 'Member not found' }, 404);

    const [self] = await db
      .select()
      .from(member)
      .where(and(eq(member.userId, sessionUser.id), eq(member.organizationId, orgId)));

    const isSelf = target.userId === sessionUser.id;
    const isOwner = self && self.role === 'owner';
    const isAdmin = self && self.role === 'admin';

    if (!isSelf) {
      if (isOwner) {
        // owner can remove anyone
      } else if (isAdmin && target.role === 'member') {
        // admin can remove members only
      } else {
        return c.json({ error: 'Insufficient permission to remove this member' }, 403);
      }
    }

    await db
      .delete(member)
      .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Owner check helper
async function isOwner(db: any, orgId: string, userId: string) {
  const [row] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  return row?.role === 'owner';
}

// Teams CRUD
// List all teams in an organisation
orgRouter.get('/:id/teams', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const teams = await db.select().from(team).where(eq(team.organizationId, orgId));
    return c.json({ teams });
  } finally {
    await conn.end();
  }
});

// Create a new team
orgRouter.post('/:id/teams', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { name } = await c.req.json();
    if (!name) return c.json({ error: 'name required' }, 400);
    const id = nanoid();
    await db.insert(team).values({
      id,
      name,
      organizationId: orgId,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return c.json({ success: true, id });
  } finally {
    await conn.end();
  }
});

// Update team
orgRouter.patch('/:id/teams/:teamId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const teamId = c.req.param('teamId');
    const { name } = await c.req.json();
    await db
      .update(team)
      .set({ name, updated_at: new Date() })
      .where(and(eq(team.id, teamId), eq(team.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Delete team
orgRouter.delete('/:id/teams/:teamId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const teamId = c.req.param('teamId');
    await db.delete(team).where(and(eq(team.id, teamId), eq(team.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Organisation settings (using metadata JSON field)
orgRouter.get('/:id/settings', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
    if (!org) return c.json({ error: 'Organization not found' }, 404);
    return c.json({ settings: org.metadata ? JSON.parse(org.metadata) : {} });
  } finally {
    await conn.end();
  }
});

orgRouter.patch('/:id/settings', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { settings } = await c.req.json(); // expect JSON serializable object
    await db
      .update(organization)
      .set({ metadata: settings ? JSON.stringify(settings) : null })
      .where(eq(organization.id, orgId));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Bulk message actions (stub)
orgRouter.post('/:id/emails/:emailId/messages/bulk', async (c) => {
  const { action, messageIds } = await c.req.json();
  // In a real implementation, perform action on messages via driver
  return c.json({ success: true, action, messageIds });
});

// Organisation email accounts CRUD via pivot table
orgRouter.get('/:id/emails', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const emails = await db
      .select({
        id: organizationConnection.id,
        alias: organizationConnection.alias,
        createdAt: organizationConnection.createdAt,
        connectionId: organizationConnection.connectionId,
        email: connectionTable.email,
        providerId: connectionTable.providerId,
        name: connectionTable.name,
        picture: connectionTable.picture,
      })
      .from(organizationConnection)
      .leftJoin(connectionTable, eq(organizationConnection.connectionId, connectionTable.id))
      .where(eq(organizationConnection.organizationId, orgId));

    return c.json({ emails });
  } finally {
    await conn.end();
  }
});

orgRouter.post('/:id/emails', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const { connectionId, alias } = await c.req.json();
    if (!connectionId) return c.json({ error: 'connectionId required' }, 400);

    const id = nanoid();
    await db.insert(organizationConnection).values({
      id,
      organizationId: orgId,
      connectionId,
      alias,
      createdAt: new Date(),
    });

    return c.json({ success: true, id });
  } finally {
    await conn.end();
  }
});

orgRouter.patch('/:id/emails/:emailId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const emailId = c.req.param('emailId');
    const { alias } = await c.req.json();
    await db
      .update(organizationConnection)
      .set({ alias })
      .where(and(eq(organizationConnection.id, emailId), eq(organizationConnection.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

orgRouter.delete('/:id/emails/:emailId', async (c) => {
  const env = c.env;
  const { db, conn } = createDb(env.HYPERDRIVE.connectionString);
  
  try {
    const orgId = c.req.param('id');
    const emailId = c.req.param('emailId');
    await db
      .delete(organizationConnection)
      .where(and(eq(organizationConnection.id, emailId), eq(organizationConnection.organizationId, orgId)));
    return c.json({ success: true });
  } finally {
    await conn.end();
  }
});

// Email messages (stubs)
orgRouter.get('/:id/emails/:emailId/messages', async (c) => {
  return c.json({ messages: [] });
});

orgRouter.get('/:id/emails/:emailId/messages/:msgId', async (c) => {
  return c.json({ message: null });
});

orgRouter.patch('/:id/emails/:emailId/messages/:msgId', async (c) => {
  return c.json({ success: true });
});

orgRouter.delete('/:id/emails/:emailId/messages/:msgId', async (c) => {
  return c.json({ success: true });
}); 

export { orgRouter }; 