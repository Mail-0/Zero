import {
  organization,
  organizationDomain,
  member,
  team,
  organizationConnection,
  connection as connectionTable,
  user,
  invitation,
  session,
} from '../../db/schema';
import { router, publicProcedure, privateProcedure } from '../trpc';
import { eq, and } from 'drizzle-orm';
import dns from 'node:dns/promises';
import { createDb } from '../../db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

async function isOwner(db: ReturnType<typeof createDb>['db'], orgId: string, userId: string) {
  const [row] = await db
    .select()
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
  return row?.role === 'owner';
}

export const organizationRouter = router({
  leave: privateProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        // Check if this is the last member
        const memberCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(member)
          .where(eq(member.organizationId, organizationId));

        const isLastMember = memberCount[0].count === 1;

        if (isLastMember) {
          // If last member, check if they're the owner
          const isOwnerCheck = await isOwner(db, organizationId, sessionUser.id);
          if (!isOwnerCheck) {
            return {
              error: 'Cannot leave organization - you must transfer ownership first',
            } as const;
          }

          // Delete the entire organization
          await db.transaction(async (tx) => {
            // First, update users who have this as their defaultOrganizationId
            await tx
              .update(user)
              .set({ defaultOrganizationId: null })
              .where(eq(user.defaultOrganizationId, organizationId));

            // Update sessions that have this as activeOrganizationId
            await tx
              .update(session)
              .set({ activeOrganizationId: null })
              .where(eq(session.activeOrganizationId, organizationId));

            // Delete all invitations
            await tx.delete(invitation).where(eq(invitation.organizationId, organizationId));

            // Delete all organization connections
            await tx
              .delete(organizationConnection)
              .where(eq(organizationConnection.organizationId, organizationId));

            // Delete all organization domains
            await tx
              .delete(organizationDomain)
              .where(eq(organizationDomain.organizationId, organizationId));

            // Delete all members (must be before teams due to FK constraint)
            await tx.delete(member).where(eq(member.organizationId, organizationId));

            // Delete all teams (after members since members reference teams)
            await tx.delete(team).where(eq(team.organizationId, organizationId));

            // Finally, delete the organization itself
            await tx.delete(organization).where(eq(organization.id, organizationId));
          });
        } else {
          // If not last member, just remove them
          await db.transaction(async (tx) => {
            // Remove user from organization
            await tx
              .delete(member)
              .where(
                and(eq(member.organizationId, organizationId), eq(member.userId, sessionUser.id)),
              );

            // Update user's defaultOrganizationId if it was this org
            const userRecord = await tx
              .select()
              .from(user)
              .where(eq(user.id, sessionUser.id))
              .limit(1);
            if (userRecord[0]?.defaultOrganizationId === organizationId) {
              await tx
                .update(user)
                .set({ defaultOrganizationId: null })
                .where(eq(user.id, sessionUser.id));
            }

            // Update session's activeOrganizationId if it was this org
            await tx
              .update(session)
              .set({ activeOrganizationId: null })
              .where(
                and(
                  eq(session.userId, sessionUser.id),
                  eq(session.activeOrganizationId, organizationId),
                ),
              );
          });
        }

        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  verifyDomain: publicProcedure
    .input(
      z.object({
        domain: z.string(),
        verificationToken: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { domain, verificationToken: providedToken } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const verificationToken = providedToken || nanoid();
        try {
          const txtRecords = await dns.resolveTxt(domain);
          const expected = `zero-verification=${verificationToken}`;
          const found = txtRecords.some((arr) => arr.join('').trim() === expected);
          if (found) {
            return {
              success: true,
              verified: true,
              message: 'Domain verified successfully!',
              verificationToken,
            } as const;
          }
          return {
            success: false,
            verified: false,
            message: `Please add this TXT record to your DNS: zero-verification=${verificationToken}`,
            verificationToken,
          } as const;
        } catch (err) {
          return {
            success: false,
            verified: false,
            error: 'DNS lookup failed',
            message: `Please add this TXT record to your DNS: zero-verification=${verificationToken}`,
            verificationToken,
            details: String(err),
          } as const;
        }
      } finally {
        await conn.end();
      }
    }),
  listDomains: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const domains = await db
          .select()
          .from(organizationDomain)
          .where(eq(organizationDomain.organizationId, organizationId));
        return {
          domains: domains.map((d) => ({
            domain: d.domain,
            verified: d.verified,
            verificationToken: d.verificationToken,
          })),
        } as const;
      } finally {
        await conn.end();
      }
    }),
  addDomain: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        domain: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, domain } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const verificationToken = nanoid();
        await db.insert(organizationDomain).values({
          id: nanoid(),
          organizationId,
          domain,
          createdAt: new Date(),
          verified: false,
          verificationToken,
        });
        return { success: true, verificationToken } as const;
      } finally {
        await conn.end();
      }
    }),
  removeDomain: privateProcedure
    .input(z.object({ organizationId: z.string(), domain: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, domain } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        await db
          .delete(organizationDomain)
          .where(
            and(
              eq(organizationDomain.organizationId, organizationId),
              eq(organizationDomain.domain, domain),
            ),
          );
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  verifyDomainForOrg: privateProcedure
    .input(z.object({ organizationId: z.string(), domain: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, domain } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [row] = await db
          .select()
          .from(organizationDomain)
          .where(
            and(
              eq(organizationDomain.organizationId, organizationId),
              eq(organizationDomain.domain, domain),
            ),
          );
        if (!row) return { error: 'Domain not found' } as const;
        if (row.verified) return { success: true, verified: true } as const;

        try {
          const txtRecords = await dns.resolveTxt(domain);
          const expected = `zero-verification=${row.verificationToken}`;
          const found = txtRecords.some((arr) => arr.join('').trim() === expected);
          if (found) {
            await db
              .update(organizationDomain)
              .set({ verified: true })
              .where(
                and(
                  eq(organizationDomain.organizationId, organizationId),
                  eq(organizationDomain.domain, domain),
                ),
              );
            return { success: true, verified: true } as const;
          }
          return { success: false, verified: false, message: 'TXT record not found' } as const;
        } catch (err) {
          return {
            success: false,
            error: 'DNS lookup failed',
            details: String(err),
          } as const;
        }
      } finally {
        await conn.end();
      }
    }),
  list: publicProcedure.query(async ({ ctx }) => {
    const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
    try {
      const orgs = await db.select().from(organization);
      return { organizations: orgs } as const;
    } finally {
      await conn.end();
    }
  }),
  create: privateProcedure
    .input(
      z.object({
        name: z.string(),
        slug: z.string().optional().nullable(),
        logo: z.string().optional().nullable(),
        metadata: z.any().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { name, slug, logo, metadata } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const id = nanoid();
        const finalSlug =
          slug ||
          name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '');
        await db.insert(organization).values({
          id,
          name,
          slug: finalSlug,
          logo,
          metadata: metadata ? JSON.stringify(metadata) : null,
          createdAt: new Date(),
        });
        if (ctx.sessionUser) {
          await db.insert(member).values({
            id: nanoid(),
            userId: ctx.sessionUser.id,
            organizationId: id,
            role: 'owner',
            createdAt: new Date(),
          });
        }
        return { success: true, organizationId: id } as const;
      } finally {
        await conn.end();
      }
    }),
  get: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [org] = await db
          .select()
          .from(organization)
          .where(eq(organization.id, organizationId));
        if (!org) return { error: 'Organization not found' } as const;
        return { organization: org } as const;
      } finally {
        await conn.end();
      }
    }),
  update: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        name: z.string().optional().nullable(),
        slug: z.string().optional().nullable(),
        logo: z.string().optional().nullable(),
        metadata: z.any().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, name, slug, logo, metadata } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        if (!(await isOwner(db, organizationId, sessionUser.id))) {
          return { error: 'Only owners can update organization' } as const;
        }
        const updatePayload: Record<string, unknown> = {};
        if (name !== undefined) updatePayload['name'] = name;
        if (slug !== undefined) updatePayload['slug'] = slug;
        if (logo !== undefined) updatePayload['logo'] = logo;
        if (metadata !== undefined)
          updatePayload['metadata'] = metadata ? JSON.stringify(metadata) : null;
        if (Object.keys(updatePayload).length) {
          await db
            .update(organization)
            .set(updatePayload as any)
            .where(eq(organization.id, organizationId));
        }
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  delete: privateProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        if (!(await isOwner(db, organizationId, sessionUser.id))) {
          return { error: 'Only owners can delete organization' } as const;
        }

        // Start transaction for cascading deletes
        await db.transaction(async (tx) => {
          // First, update users who have this as their defaultOrganizationId
          await tx
            .update(user)
            .set({ defaultOrganizationId: null })
            .where(eq(user.defaultOrganizationId, organizationId));

          // Update sessions that have this as activeOrganizationId
          await tx
            .update(session)
            .set({ activeOrganizationId: null })
            .where(eq(session.activeOrganizationId, organizationId));

          // Delete all invitations
          await tx.delete(invitation).where(eq(invitation.organizationId, organizationId));

          // Delete all organization connections
          await tx
            .delete(organizationConnection)
            .where(eq(organizationConnection.organizationId, organizationId));

          // Delete all organization domains
          await tx
            .delete(organizationDomain)
            .where(eq(organizationDomain.organizationId, organizationId));

          // Delete all members (must be before teams due to FK constraint)
          await tx.delete(member).where(eq(member.organizationId, organizationId));

          // Delete all teams (after members since members reference teams)
          await tx.delete(team).where(eq(team.organizationId, organizationId));

          // Finally, delete the organization itself
          await tx.delete(organization).where(eq(organization.id, organizationId));
        });

        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  listMembers: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
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
          .where(eq(member.organizationId, organizationId));
        const rolePriority: Record<string, number> = { owner: 3, admin: 2, member: 1 };
        const map = new Map<string, (typeof rows)[0]>();
        for (const r of rows) {
          const existing = map.get(r.userId);
          if (!existing || rolePriority[r.role] > rolePriority[existing.role]) {
            map.set(r.userId, r);
          }
        }
        return { members: Array.from(map.values()) } as const;
      } finally {
        await conn.end();
      }
    }),
  upsertMember: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        userId: z.string(),
        role: z.enum(['owner', 'admin', 'member']).optional().default('member'),
        teamId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, userId, role, teamId } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [self] = await db
          .select()
          .from(member)
          .where(and(eq(member.organizationId, organizationId), eq(member.userId, sessionUser.id)));
        if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
          return { error: 'Only owners or admins can add members' } as const;
        }
        if (self.role === 'admin' && role !== 'member') {
          return { error: 'Admins can only add members with role "member"' } as const;
        }
        const existing = await db
          .select()
          .from(member)
          .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));
        if (existing.length === 0) {
          await db.insert(member).values({
            id: nanoid(),
            userId,
            organizationId,
            role,
            teamId,
            createdAt: new Date(),
          });
        } else {
          await db
            .update(member)
            .set({ role, teamId })
            .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)));
        }
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  updateMember: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        memberId: z.string(),
        role: z.enum(['owner', 'admin', 'member']).optional(),
        teamId: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, memberId, role, teamId } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [self] = await db
          .select()
          .from(member)
          .where(and(eq(member.organizationId, organizationId), eq(member.userId, sessionUser.id)));
        if (!self || (self.role !== 'owner' && self.role !== 'admin')) {
          return { error: 'Only owners or admins can update members' } as const;
        }
        const [target] = await db
          .select()
          .from(member)
          .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)));
        if (!target) return { error: 'Member not found' } as const;
        if (self.role === 'admin') {
          if (target.role !== 'member' || role !== 'member') {
            return { error: 'Admins can only modify members' } as const;
          }
        }
        const updatePayload2: Record<string, unknown> = {};
        if (role !== undefined) updatePayload2['role'] = role;
        if (teamId !== undefined) updatePayload2['teamId'] = teamId;
        if (Object.keys(updatePayload2).length) {
          await db
            .update(member)
            .set(updatePayload2 as any)
            .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)));
        }
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  removeMember: privateProcedure
    .input(z.object({ organizationId: z.string(), memberId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, memberId } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [target] = await db
          .select()
          .from(member)
          .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)));
        if (!target) return { error: 'Member not found' } as const;
        const [self] = await db
          .select()
          .from(member)
          .where(and(eq(member.userId, sessionUser.id), eq(member.organizationId, organizationId)));
        const isSelf = target.userId === sessionUser.id;
        const isOwnerRole = self && self.role === 'owner';
        const isAdminRole = self && self.role === 'admin';
        if (!isSelf) {
          if (isOwnerRole) {
          } else if (isAdminRole && target.role === 'member') {
          } else {
            return { error: 'Insufficient permission to remove this member' } as const;
          }
        }
        await db
          .delete(member)
          .where(and(eq(member.id, memberId), eq(member.organizationId, organizationId)));
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  listTeams: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const teams = await db.select().from(team).where(eq(team.organizationId, organizationId));
        return { teams } as const;
      } finally {
        await conn.end();
      }
    }),
  createTeam: privateProcedure
    .input(z.object({ organizationId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, name } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const id = nanoid();
        await db.insert(team).values({
          id,
          name,
          organizationId,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, id } as const;
      } finally {
        await conn.end();
      }
    }),
  updateTeam: privateProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string(), name: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, teamId, name } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        await db
          .update(team)
          .set({ name, updated_at: new Date() })
          .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)));
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  deleteTeam: privateProcedure
    .input(z.object({ organizationId: z.string(), teamId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, teamId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        await db
          .delete(team)
          .where(and(eq(team.id, teamId), eq(team.organizationId, organizationId)));
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  getSettings: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const [org] = await db
          .select()
          .from(organization)
          .where(eq(organization.id, organizationId));
        if (!org) return { error: 'Organization not found' } as const;
        return { settings: org.metadata ? JSON.parse(org.metadata) : {} } as const;
      } finally {
        await conn.end();
      }
    }),
  updateSettings: privateProcedure
    .input(z.object({ organizationId: z.string(), settings: z.any().optional().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, settings } = input;
      const { sessionUser } = ctx;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        if (!(await isOwner(db, organizationId, sessionUser.id))) {
          return { error: 'Only owners can update settings' } as const;
        }
        await db
          .update(organization)
          .set({ metadata: settings ? JSON.stringify(settings) : null })
          .where(eq(organization.id, organizationId));
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  listEmails: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { organizationId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
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
          .where(eq(organizationConnection.organizationId, organizationId));
        return { emails } as const;
      } finally {
        await conn.end();
      }
    }),
  addEmail: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        connectionId: z.string(),
        alias: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, connectionId, alias } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        const id = nanoid();
        await db.insert(organizationConnection).values({
          id,
          organizationId,
          connectionId,
          alias,
          createdAt: new Date(),
        });
        return { success: true, id } as const;
      } finally {
        await conn.end();
      }
    }),
  updateEmail: privateProcedure
    .input(
      z.object({
        organizationId: z.string(),
        emailId: z.string(),
        alias: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { organizationId, emailId, alias } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        await db
          .update(organizationConnection)
          .set({ alias })
          .where(
            and(
              eq(organizationConnection.id, emailId),
              eq(organizationConnection.organizationId, organizationId),
            ),
          );
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
  removeEmail: privateProcedure
    .input(z.object({ organizationId: z.string(), emailId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { organizationId, emailId } = input;
      const { db, conn } = createDb(ctx.c.env.HYPERDRIVE.connectionString);
      try {
        await db
          .delete(organizationConnection)
          .where(
            and(
              eq(organizationConnection.id, emailId),
              eq(organizationConnection.organizationId, organizationId),
            ),
          );
        return { success: true } as const;
      } finally {
        await conn.end();
      }
    }),
});
