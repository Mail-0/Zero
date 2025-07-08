import { Hono } from 'hono';
import { getZeroDB } from '../lib/server-utils';
import { organizationDomain } from '../db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import dns from 'node:dns/promises';
import type { HonoContext } from '../ctx';


const orgRouter = new Hono<HonoContext>();

// Verify domain ownership (without organization ID)
orgRouter.post('/verify-domain', async (c) => {
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
});

// Get allowed domains
orgRouter.get('/:id/domains', async (c) => {
  const orgId = c.req.param('id');
  const sessionUser = c.get('sessionUser');
  if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
  const db = getZeroDB(sessionUser.id);
  const domains = await db.findOrganizationDomains(orgId);
  // Return all relevant info for verification
  return c.json({
    domains: domains.map((d: typeof organizationDomain.$inferSelect) => ({
      domain: d.domain,
      verified: d.verified,
      verificationToken: d.verificationToken,
    })),
  });
});

// Add a domain
orgRouter.post('/:id/domains', async (c) => {
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
});

// Remove a domain
orgRouter.delete('/:id/domains', async (c) => {
  const orgId = c.req.param('id');
  const { domain } = await c.req.json();
  if (!domain) return c.json({ error: 'Domain required' }, 400);
  const sessionUser = c.get('sessionUser');
  if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
  const db = getZeroDB(sessionUser.id);
  await db.deleteOrganizationDomain(orgId, domain);
  return c.json({ success: true });
});

// Verify a domain via DNS TXT record
orgRouter.post('/:id/domains/verify', async (c) => {
  const orgId = c.req.param('id');
  const { domain } = await c.req.json();
  if (!domain) return c.json({ error: 'Domain required' }, 400);
  const sessionUser = c.get('sessionUser');
  if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
  const db = getZeroDB(sessionUser.id);
  // Get the domain row
  const row = await db.findOrganizationDomain(orgId, domain);
  if (!row) return c.json({ error: 'Domain not found' }, 404);
  if (row.verified) return c.json({ success: true, verified: true });
  // Check DNS TXT record
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const expected = `zero-verification=${row.verificationToken}`;
    const found = txtRecords.some((arr) => arr.join('').trim() === expected);
    if (found) {
      await db.updateOrganizationDomain(orgId, domain, { verified: true });
      return c.json({ success: true, verified: true });
    } else {
      return c.json({ success: false, verified: false, message: 'TXT record not found' });
    }
  } catch (err) {
    return c.json({ success: false, error: 'DNS lookup failed', details: String(err) });
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

export { orgRouter }; 