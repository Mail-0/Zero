import { createRateLimiterMiddleware, privateProcedure, publicProcedure, router } from '../trpc';
import { getActiveConnection } from '../../lib/server-utils';
import { connection, user as user_ } from '../../db/schema';
import { Ratelimit } from '@upstash/ratelimit';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const connectionsRouter = router({
  list: privateProcedure
    .use(
      createRateLimiterMiddleware({
        limiter: Ratelimit.slidingWindow(60, '1m'),
        generatePrefix: ({ sessionUser }) => `ratelimit:get-connections-${sessionUser?.id}`,
      }),
    )
    .query(async ({ ctx }) => {
      const { db, sessionUser } = ctx;
      const connections = await db
        .select({
          id: connection.id,
          email: connection.email,
          name: connection.name,
          picture: connection.picture,
          createdAt: connection.createdAt,
          providerId: connection.providerId,
          accessToken: connection.accessToken,
          refreshToken: connection.refreshToken,
          orderIndex: connection.orderIndex,
        })
        .from(connection)
        .where(eq(connection.userId, sessionUser.id))
        .orderBy(connection.orderIndex);

      const disconnectedIds = connections
        .filter((c) => !c.accessToken || !c.refreshToken)
        .map((c) => c.id);

      return {
        connections: connections.map((connection) => {
          return {
            id: connection.id,
            email: connection.email,
            name: connection.name,
            picture: connection.picture,
            createdAt: connection.createdAt,
            providerId: connection.providerId,
            orderIndex: connection.orderIndex,
          };
        }),
        disconnectedIds,
      };
    }),
  setDefault: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { db } = ctx;
      const user = ctx.sessionUser;
      const foundConnection = await db.query.connection.findFirst({
        where: and(eq(connection.id, connectionId), eq(connection.userId, user.id)),
      });
      if (!foundConnection) throw new TRPCError({ code: 'NOT_FOUND' });
      await db
        .update(user_)
        .set({ defaultConnectionId: connectionId })
        .where(eq(user_.id, user.id));
    }),
  delete: privateProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { connectionId } = input;
      const { db } = ctx;
      const user = ctx.sessionUser;
      await db
        .delete(connection)
        .where(and(eq(connection.id, connectionId), eq(connection.userId, user.id)));

      const activeConnection = await getActiveConnection();
      if (connectionId === activeConnection.id)
        await db.update(user_).set({ defaultConnectionId: null });
    }),
  getDefault: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.sessionUser) return null;
    const connection = await getActiveConnection();
    return {
      id: connection.id,
      email: connection.email,
      name: connection.name,
      picture: connection.picture,
      createdAt: connection.createdAt,
      providerId: connection.providerId,
    };
  }),
  reorder: privateProcedure
    .input(
      z.object({
        connectionIds: z.array(z.string().uuid()).min(1, 'At least one connection ID is required'),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { connectionIds } = input;
      const { db } = ctx;
      const user = ctx.sessionUser;

      // Check for duplicate connection IDs
      if (new Set(connectionIds).size !== connectionIds.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Duplicate connection IDs supplied',
        });
      } // Verify all connections belong to the user
      const userConnections = await db
        .select({ id: connection.id })
        .from(connection)
        .where(eq(connection.userId, user.id));

      const userConnectionSet = new Set(userConnections.map((c) => c.id));
      const invalidIds = connectionIds.filter((id) => !userConnectionSet.has(id));

      if (invalidIds.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid connection IDs: ${invalidIds.join(', ')}`,
        });
      } // Get the default connection to ensure it stays at index 0
      const activeConnection = await getActiveConnection();
      const defaultConnectionId = activeConnection?.id;

      // Verify payload includes all connections with default connection first
      const totalConnections = userConnections.length;
      if (connectionIds.length !== totalConnections) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reorder payload must include all connection IDs',
        });
      }

      if (defaultConnectionId && connectionIds[0] !== defaultConnectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Default connection must be first in the reorder list',
        });
      } // Update order for each connection atomically using a transaction
      await db.transaction(async (tx) => {
        // Since we validate that the default connection is first in the payload,
        // we can safely update all connections without shifting since the
        // default connection will retain its position at index 0
        await tx.execute(sql`
          UPDATE ${connection} AS c
          SET ${connection.orderIndex} = v.rn
          FROM (VALUES ${sql.join(connectionIds.map((id, i) => sql`(${id}, ${i})`))} ) AS v(id, rn)
          WHERE c.id = v.id AND c.user_id = ${user.id}
        `);
      });
    }),
});
