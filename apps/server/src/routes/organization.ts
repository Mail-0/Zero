import { Hono } from 'hono';
import type { HonoContext } from '../ctx';
import { serverTrpc } from '../trpc';

const orgRouter = new Hono<HonoContext>();

const getCaller = () => serverTrpc();

// domains
orgRouter.post('/verify-domain', async (c) => {
  const { domain, verificationToken } = await c.req.json();
  const data = await getCaller().organization.verifyDomain({ domain, verificationToken });
  return c.json(data);
});

orgRouter.get('/:id/domains', async (c) => {
  const data = await getCaller().organization.listDomains({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.post('/:id/domains', async (c) => {
  const { domain } = await c.req.json();
  const data = await getCaller().organization.addDomain({ organizationId: c.req.param('id'), domain });
  return c.json(data);
});

orgRouter.delete('/:id/domains', async (c) => {
  const { domain } = await c.req.json();
  const data = await getCaller().organization.removeDomain({ organizationId: c.req.param('id'), domain });
  return c.json(data);
});

orgRouter.post('/:id/domains/verify', async (c) => {
  const { domain } = await c.req.json();
  const data = await getCaller().organization.verifyDomainForOrg({ organizationId: c.req.param('id'), domain });
  return c.json(data);
});

// org crud
orgRouter.get('/', async () => {
  return new Response(JSON.stringify(await getCaller().organization.list()), {
    headers: { 'Content-Type': 'application/json' },
  });
});

orgRouter.post('/', async (c) => {
  const body = await c.req.json();
  const data = await getCaller().organization.create(body);
  return c.json(data);
});

orgRouter.get('/:id', async (c) => {
  const data = await getCaller().organization.get({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.patch('/:id', async (c) => {
  const body = await c.req.json();
  const data = await getCaller().organization.update({ organizationId: c.req.param('id'), ...body });
  return c.json(data);
});

orgRouter.delete('/:id', async (c) => {
  const data = await getCaller().organization.delete({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.post('/:id/leave', async (c) => {
  const { sessionUser } = c.var;
  if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
  const caller = getCaller();
  const members = await caller.organization.listMembers({ organizationId: c.req.param('id') });
  const self = members.members?.find((m) => m.userId === sessionUser.id);
  if (!self) return c.json({ error: 'Member not found' }, 404);
  const data = await caller.organization.removeMember({ organizationId: c.req.param('id'), memberId: self.id });
  return c.json(data);
});

// members
orgRouter.get('/:id/members', async (c) => {
  const data = await getCaller().organization.listMembers({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.post('/:id/members', async (c) => {
  const body = await c.req.json();
  const data = await getCaller().organization.upsertMember({ organizationId: c.req.param('id'), ...body });
  return c.json(data);
});

orgRouter.patch('/:id/members/:memberId', async (c) => {
  const body = await c.req.json();
  const data = await getCaller().organization.updateMember({ organizationId: c.req.param('id'), memberId: c.req.param('memberId'), ...body });
  return c.json(data);
});

orgRouter.delete('/:id/members/:memberId', async (c) => {
  const data = await getCaller().organization.removeMember({ organizationId: c.req.param('id'), memberId: c.req.param('memberId') });
  return c.json(data);
});

// teams
orgRouter.get('/:id/teams', async (c) => {
  const data = await getCaller().organization.listTeams({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.post('/:id/teams', async (c) => {
  const { name } = await c.req.json();
  const data = await getCaller().organization.createTeam({ organizationId: c.req.param('id'), name });
  return c.json(data);
});

orgRouter.patch('/:id/teams/:teamId', async (c) => {
  const { name } = await c.req.json();
  const data = await getCaller().organization.updateTeam({ organizationId: c.req.param('id'), teamId: c.req.param('teamId'), name });
  return c.json(data);
});

orgRouter.delete('/:id/teams/:teamId', async (c) => {
  const data = await getCaller().organization.deleteTeam({ organizationId: c.req.param('id'), teamId: c.req.param('teamId') });
  return c.json(data);
});

// settings
orgRouter.get('/:id/settings', async (c) => {
  const data = await getCaller().organization.getSettings({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.patch('/:id/settings', async (c) => {
  const { settings } = await c.req.json();
  const data = await getCaller().organization.updateSettings({ organizationId: c.req.param('id'), settings });
  return c.json(data);
});

// mail accounts
orgRouter.get('/:id/emails', async (c) => {
  const data = await getCaller().organization.listEmails({ organizationId: c.req.param('id') });
  return c.json(data);
});

orgRouter.post('/:id/emails', async (c) => {
  const body = await c.req.json();
  const data = await getCaller().organization.addEmail({ organizationId: c.req.param('id'), ...body });
  return c.json(data);
});

orgRouter.patch('/:id/emails/:emailId', async (c) => {
  const { alias } = await c.req.json();
  const data = await getCaller().organization.updateEmail({ organizationId: c.req.param('id'), emailId: c.req.param('emailId'), alias });
  return c.json(data);
});

orgRouter.delete('/:id/emails/:emailId', async (c) => {
  const data = await getCaller().organization.removeEmail({ organizationId: c.req.param('id'), emailId: c.req.param('emailId') });
  return c.json(data);
});

export { orgRouter };