import {
  connection,
  user as _user,
  account,
  userSettings,
  session,
  userHotkeys,
} from '@zero/db/schema';
import { createAuthMiddleware, customSession } from 'better-auth/plugins';
import { defaultUserSettings } from '@zero/db/user_settings_default';
import { getBrowserTimezone, isValidTimezone } from './timezones';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { type Account, betterAuth } from 'better-auth';
import { getSocialProviders } from './auth-providers';
import { getActiveDriver } from './driver/utils';
import { APIError } from 'better-auth/api';
import type { HonoContext } from '../ctx';
import { createDriver } from './driver';
import { resend } from './services';
import { eq } from 'drizzle-orm';

const connectionHandlerHook = async (account: Account, c: HonoContext) => {
  if (!account.accessToken || !account.refreshToken) {
    console.error('Missing Access/Refresh Tokens', { account });
    throw new APIError('EXPECTATION_FAILED', { message: 'Missing Access/Refresh Tokens' });
  }

  const driver = createDriver(account.providerId, {
    auth: { accessToken: account.accessToken, refreshToken: account.refreshToken, email: '' },
    c,
  });
  const userInfo = await driver.getUserInfo().catch(() => {
    throw new APIError('UNAUTHORIZED', { message: 'Failed to get user info' });
  });

  if (!userInfo?.address) {
    console.error('Missing email in user info:', { userInfo });
    throw new APIError('BAD_REQUEST', { message: 'Missing "email" in user info' });
  }

  const updatingInfo = {
    name: userInfo.name || 'Unknown',
    picture: userInfo.photo || '',
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    scope: driver.getScope(),
    expiresAt: new Date(Date.now() + (account.accessTokenExpiresAt?.getTime() || 3600000)),
  };

  await c.var.db
    .insert(connection)
    .values({
      providerId: account.providerId,
      id: crypto.randomUUID(),
      email: userInfo.address,
      userId: account.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...updatingInfo,
    })
    .onConflictDoUpdate({
      target: [connection.email, connection.userId],
      set: {
        ...updatingInfo,
        updatedAt: new Date(),
      },
    });
};

export const createAuth = (c: HonoContext) =>
  betterAuth({
    database: drizzleAdapter(c.var.db, { provider: 'pg' }),
    advanced: {
      ipAddress: {
        disableIpTracking: true,
      },
      crossSubDomainCookies: {
        enabled: true,
        domain: c.env.COOKIE_DOMAIN,
      },
    },
    baseURL: c.env.NEXT_PUBLIC_BACKEND_URL,
    trustedOrigins: [c.env.NEXT_PUBLIC_APP_URL, c.env.NEXT_PUBLIC_BACKEND_URL],
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user, request) => {
          if (!request) throw new APIError('BAD_REQUEST', { message: 'Request object is missing' });
          const driver = await getActiveDriver(c);
          const refreshToken = (
            await c.var.db.select().from(connection).where(eq(connection.userId, user.id)).limit(1)
          )[0]?.refreshToken;
          const revoked = await driver.revokeRefreshToken(refreshToken || '');
          if (!revoked) {
            console.error('Failed to revoke refresh token');
            return;
          }

          await c.var.db.transaction(async (tx) => {
            await tx.delete(connection).where(eq(connection.userId, user.id));
            await tx.delete(account).where(eq(account.userId, user.id));
            await tx.delete(session).where(eq(session.userId, user.id));
            await tx.delete(userSettings).where(eq(userSettings.userId, user.id));
            await tx.delete(_user).where(eq(_user.id, user.id));
            await tx.delete(userHotkeys).where(eq(userHotkeys.userId, user.id));
          });
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 7 days
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
    },
    socialProviders: getSocialProviders(c.env as unknown as Record<string, string>),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
        trustedProviders: ['google', 'microsoft'],
      },
    },
    databaseHooks: {
      account: {
        create: {
          after: (account) => connectionHandlerHook(account, c),
        },
        update: {
          after: (account) => connectionHandlerHook(account, c),
        },
      },
    },
    emailAndPassword: {
      enabled: false,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await resend().emails.send({
          from: '0.email <onboarding@0.email>',
          to: user.email,
          subject: 'Reset your password',
          html: `
            <h2>Reset Your Password</h2>
            <p>Click the link below to reset your password:</p>
            <a href="${url}">${url}</a>
            <p>If you didn't request this, you can safely ignore this email.</p>
          `,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        const verificationUrl = `${c.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=/settings/connections`;

        await resend().emails.send({
          from: '0.email <onboarding@0.email>',
          to: user.email,
          subject: 'Verify your 0.email account',
          html: `
            <h2>Verify Your 0.email Account</h2>
            <p>Click the link below to verify your email:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          `,
        });
      },
    },
    plugins: [
      customSession(async ({ user, session }) => {
        const foundUser = await c.var.db.query.user.findFirst({
          where: eq(_user.id, user.id),
        });

        let activeConnection = null;

        if (foundUser?.defaultConnectionId) {
          // Get the active connection details
          const [connectionDetails] = await c.var.db
            .select()
            .from(connection)
            .where(eq(connection.id, foundUser.defaultConnectionId))
            .limit(1);

          if (connectionDetails) {
            activeConnection = {
              id: connectionDetails.id,
              name: connectionDetails.name,
              email: connectionDetails.email,
              picture: connectionDetails.picture,
            };
          } else {
            await c.var.db
              .update(_user)
              .set({
                defaultConnectionId: null,
              })
              .where(eq(_user.id, user.id));
          }
        }

        if (!foundUser?.defaultConnectionId) {
          const [defaultConnection] = await c.var.db
            .select()
            .from(connection)
            .where(eq(connection.userId, user.id))
            .limit(1);

          if (defaultConnection) {
            activeConnection = {
              id: defaultConnection.id,
              name: defaultConnection.name,
              email: defaultConnection.email,
              picture: defaultConnection.picture,
            };
          }

          if (!defaultConnection) {
            // find the user account the user has
            const [userAccount] = await c.var.db
              .select()
              .from(account)
              .where(eq(account.userId, user.id))
              .limit(1);
            if (userAccount) {
              const newConnectionId = crypto.randomUUID();
              // create a new connection
              const [newConnection] = await c.var.db.insert(connection).values({
                id: newConnectionId,
                userId: user.id,
                email: user.email,
                name: user.name,
                picture: user.image,
                accessToken: userAccount.accessToken,
                refreshToken: userAccount.refreshToken,
                scope: userAccount.scope,
                providerId: userAccount.providerId,
                expiresAt: new Date(
                  Date.now() + (userAccount.accessTokenExpiresAt?.getTime() || 3600000),
                ),
                createdAt: new Date(),
                updatedAt: new Date(),
              } as typeof connection.$inferInsert);
              // this type error is pissing me tf off
              if (newConnection) {
                //   void enableBrainFunction({ id: newConnectionId, providerId: userAccount.providerId });
                console.warn('Created new connection for user', user.email);
              }
            }
          }
        }

        return {
          connectionId: activeConnection?.id || null,
          activeConnection,
          user,
          session,
        };
      }),
    ],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        // all hooks that run on sign-up routes
        if (ctx.path.startsWith('/sign-up')) {
          // only true if this request is from a new user
          const newSession = ctx.context.newSession;
          if (newSession) {
            // Check if user already has settings
            const [existingSettings] = await c.var.db
              .select()
              .from(userSettings)
              .where(eq(userSettings.userId, newSession.user.id))
              .limit(1);

            if (!existingSettings) {
              // get timezone from vercel's header
              const headerTimezone = ctx.headers?.get('x-vercel-ip-timezone');
              // validate timezone from header or fallback to browser timezone
              const timezone =
                headerTimezone && isValidTimezone(headerTimezone)
                  ? headerTimezone
                  : getBrowserTimezone();
              // write default settings against the user
              await c.var.db.insert(userSettings).values({
                id: crypto.randomUUID(),
                userId: newSession.user.id,
                settings: {
                  ...defaultUserSettings,
                  timezone,
                },
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
        }
      }),
    },
  });

export type Auth = ReturnType<typeof createAuth>;
