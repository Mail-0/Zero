import {
  connection,
  user as _user,
  account,
  userSettings,
  session,
  userHotkeys,
} from '../db/schema';
import { createAuthMiddleware, phoneNumber, jwt, bearer } from 'better-auth/plugins';
import { type Account, betterAuth, type BetterAuthOptions } from 'better-auth';
import { getBrowserTimezone, isValidTimezone } from './timezones';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getSocialProviders } from './auth-providers';
import { redis, resend, twilio } from './services';
import { getContext } from 'hono/context-storage';
import { getActiveDriver } from './driver/utils';
import { defaultUserSettings } from './schemas';
import { APIError } from 'better-auth/api';
import type { HonoContext } from '../ctx';
import { env } from 'cloudflare:workers';
import { createDriver } from './driver';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';

const connectionHandlerHook = async (account: Account) => {
  const c = getContext<HonoContext>();

  if (!account.accessToken || !account.refreshToken) {
    console.error('Missing Access/Refresh Tokens', { account });
    throw new APIError('EXPECTATION_FAILED', { message: 'Missing Access/Refresh Tokens' });
  }

  const driver = createDriver(account.providerId, {
    auth: {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      userId: account.userId,
      email: '',
    },
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
      providerId: account.providerId as 'google' | 'microsoft',
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

export const createAuth = () => {
  const c = getContext<HonoContext>();
  const twilioClient = twilio();

  return betterAuth({
    plugins: [
      jwt(),
      bearer(),
      phoneNumber({
        sendOTP: async ({ code, phoneNumber }) => {
          await twilioClient.messages
            .send(phoneNumber, `Your verification code is: ${code}, do not share it with anyone.`)
            .catch((error) => {
              console.error('Failed to send OTP', error);
              throw new APIError('INTERNAL_SERVER_ERROR', {
                message: `Failed to send OTP, ${error.message}`,
              });
            });
        },
      }),
    ],
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user, request) => {
          if (!request) throw new APIError('BAD_REQUEST', { message: 'Request object is missing' });
          const connections = await c.var.db.query.connection.findMany({
            where: eq(connection.userId, user.id),
          });

          const revokedAccounts = (
            await Promise.allSettled(
              connections.map(async (connection) => {
                if (!connection.accessToken || !connection.refreshToken) return false;
                const driver = createDriver(connection.providerId, {
                  auth: {
                    accessToken: connection.accessToken,
                    refreshToken: connection.refreshToken,
                    userId: user.id,
                    email: connection.email,
                  },
                });
                const token = connection.refreshToken;
                return await driver.revokeToken(token || '');
              }),
            )
          ).map((result) => {
            if (result.status === 'fulfilled') {
              return result.value;
            }
            return false;
          });

          if (revokedAccounts.every((value) => !!value)) {
            console.log('Failed to revoke some accounts');
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
    databaseHooks: {
      account: {
        create: {
          after: connectionHandlerHook,
        },
        update: {
          after: connectionHandlerHook,
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
        const verificationUrl = `${c.env.VITE_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=/settings/connections`;

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
    ...createAuthConfig(),
  });
};

const createAuthConfig = () => {
  const cache = redis();
  const db = createDb(env.HYPERDRIVE.connectionString);
  return {
    database: drizzleAdapter(db, { provider: 'pg' }),
    secondaryStorage: {
      get: async (key: string) => {
        return ((await cache.get(key)) as string) ?? null;
      },
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) await cache.set(key, value, { ex: ttl });
        else await cache.set(key, value);
      },
      delete: async (key: string) => {
        await cache.del(key);
      },
    },
    advanced: {
      ipAddress: {
        disableIpTracking: true,
      },
      cookiePrefix: env.NODE_ENV === 'development' ? 'better-auth-dev' : 'better-auth',
      crossSubDomainCookies: {
        enabled: true,
        domain: env.COOKIE_DOMAIN,
      },
    },
    baseURL: env.VITE_PUBLIC_BACKEND_URL,
    trustedOrigins: [
      'https://app.0.email',
      'https://sapi.0.email',
      'https://staging.0.email',
      'https://0.email',
      'http://localhost:3000',
    ],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      },
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 3, // 1 day (every 1 day the session expiration is updated)
    },
    socialProviders: getSocialProviders(env as unknown as Record<string, string>),
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
        trustedProviders: ['google', 'microsoft'],
      },
    },
  } satisfies BetterAuthOptions;
};

export const createSimpleAuth = () => {
  return betterAuth(createAuthConfig());
};

export type Auth = ReturnType<typeof createAuth>;
export type SimpleAuth = ReturnType<typeof createSimpleAuth>;
