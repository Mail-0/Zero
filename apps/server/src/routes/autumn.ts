import { fetchPricingTable } from 'autumn-js';
import type { HonoContext } from '../ctx';
import { env } from 'cloudflare:workers';
import { Hono } from 'hono';

const sanitizeCustomerBody = (body: any) => {
  let bodyCopy = { ...body };
  delete bodyCopy.id;
  delete bodyCopy.name;
  delete bodyCopy.email;
  return bodyCopy;
};

type AutumnContext = {
  Variables: {
    customerData: {
      customerId: string;
      customerData: {
        name: string;
        email: string;
      };
    } | null;
  };
} & HonoContext;

export const autumnApi = new Hono<AutumnContext>()
  .use('*', async (c, next) => {
    const { sessionUser } = c.var;
    c.set(
      'customerData',
      !sessionUser
        ? null
        : {
            customerId: sessionUser.id,
            customerData: {
              name: sessionUser.name,
              email: sessionUser.email,
            },
          },
    );
    await next();
  })
  .post('/customers', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers
        .create({
          id: customerData.customerId,
          ...customerData.customerData,
          ...sanitizeCustomerBody(body),
        })
        .then((data) => data.data),
    );
  })
  .post('/attach', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .attach({
          ...sanitizedBody,
          customer_id: customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/cancel', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .cancel({
          ...sanitizedBody,
          customer_id: customerData.customerId,
        })
        .then((data) => data.data),
    );
  })
  .post('/check', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .check({
          ...sanitizedBody,
          customer_id: customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/track', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    const sanitizedBody = sanitizeCustomerBody(body);
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn
        .track({
          ...sanitizedBody,
          customer_id: customerData.customerId,
          customer_data: customerData.customerData,
        })
        .then((data) => data.data),
    );
  })
  .post('/billing_portal', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers.billingPortal(customerData.customerId, body).then((data) => data.data),
    );
  })
  .post('/openBillingPortal', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.customers
        .billingPortal(customerData.customerId, {
          ...body,
          return_url: `${env.VITE_PUBLIC_APP_URL}`,
        })
        .then((data) => data.data),
    );
  })
  .post('/entities', async (c) => {
    const { autumn, customerData } = c.var;
    const body = await c.req.json();
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    return c.json(
      await autumn.entities.create(customerData.customerId, body).then((data) => data.data),
    );
  })
  .get('/entities/:entityId', async (c) => {
    const { autumn, customerData } = c.var;
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    const entityId = c.req.param('entityId');
    const expand = c.req.query('expand')?.split(',') as 'invoices'[] | undefined;

    if (!entityId) {
      return c.json(
        {
          error: 'no_entity_id',
          message: 'Entity ID is required',
        },
        400,
      );
    }

    return c.json(
      await autumn.entities
        .get(customerData.customerId, entityId, { expand })
        .then((data) => data.data),
    );
  })
  .delete('/entities/:entityId', async (c) => {
    const { autumn, customerData } = c.var;
    if (!customerData) return c.json({ error: 'No customer ID found' }, 401);

    const entityId = c.req.param('entityId');

    if (!entityId) {
      return c.json(
        {
          error: 'no_entity_id',
          message: 'Entity ID is required',
        },
        400,
      );
    }

    return c.json(
      await autumn.entities.delete(customerData.customerId, entityId).then((data) => data.data),
    );
  })
  .get('/components/pricing_table', async (c) => {
    const { autumn, customerData } = c.var;

    return c.json(
      await fetchPricingTable({
        instance: autumn,
        params: {
          customer_id: customerData?.customerId || undefined,
        },
      }).then((data) => data.data),
    );
  });
