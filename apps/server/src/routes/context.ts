import { Hono } from 'hono';
import { inArray, ne, sql, and, eq } from 'drizzle-orm';
import { contacts, deals, associations_contact_deal } from '../db/schema';
import type { HonoContext } from '../ctx';

export const contextApi = new Hono<HonoContext>();

contextApi.get('/', async (c) => {
  const email = c.req.query('email');

  if (!email) {
    return c.json({ error: 'Missing email query param' }, 400);
  }

  const db = c.get('db');

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.email, email),
  });

  if (!contact) {
    return c.json({ contact: null, deals: [] });
  }

  const contactDeals = await db
  .select({
    dealId: deals.stacksync_record_id_rr1kp8,
    dealName: deals.dealname,
    stage: deals.dealstage,
    amount: deals.amount,
    closeDate: deals.closedate,
    nextActivity: deals.engagements_last_meeting_booked,
  })
  .from(associations_contact_deal)
  .innerJoin(deals, eq(associations_contact_deal.deal_id, deals.id))
  .where(
    and(
      eq(associations_contact_deal.contact_id, contact.id!),
      sql`deals.dealstage NOT IN ('closedwon', 'closedlost')`
    )
  )
  return c.json({
    contact: {
      id: contact.id,
      name: `${contact.firstname} ${contact.lastname}`,
      jobTitle: contact.jobtitle,
      companyName: contact.company,
    },
    deals: contactDeals,
  });
});
