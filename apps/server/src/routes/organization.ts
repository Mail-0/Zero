import { Hono } from 'hono';
import { createDb } from '../db';
import { organizationDomain } from '../db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';
import dns from 'node:dns/promises';

const { db } = createDb(process.env.DATABASE_URL!);
const orgRouter = new Hono();

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
});

// Add a domain
orgRouter.post('/:id/domains', async (c) => {
  const orgId = c.req.param('id');
  const { domain } = await c.req.json();
  if (!domain) return c.json({ error: 'Domain required' }, 400);
  const verificationToken = nanoid();
  await db.insert(organizationDomain).values({
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
  await db.delete(organizationDomain)
    .where(and(eq(organizationDomain.organizationId, orgId), eq(organizationDomain.domain, domain)));
  return c.json({ success: true });
});

// Verify a domain via DNS TXT record
orgRouter.post('/:id/domains/verify', async (c) => {
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
});

export { orgRouter }; 