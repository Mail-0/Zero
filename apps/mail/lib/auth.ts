/* eslint-disable @typescript-eslint/no-explicit-any */
import { connection, user as _user, account, userSettings, earlyAccess } from '@zero/db/schema';
import { createAuthMiddleware, customSession } from 'better-auth/plugins';
import { Account, betterAuth, type BetterAuthOptions } from 'better-auth';
import { getBrowserTimezone, isValidTimezone } from '@/lib/timezones';
import { defaultUserSettings } from '@zero/db/user_settings_default';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getSocialProviders } from './auth-providers';
import { createDriver } from '@/app/api/driver';
import { redirect } from 'next/navigation';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '@zero/db';

// If there is no resend key, it might be a local dev environment
// In that case, we don't want to send emails and just log them
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async (...args: any[]) => console.log(args) } };

const connectionHandlerHook = async (account: Account) => {
  if (!account.accessToken || !account.refreshToken) {
    console.error('Missing Access/Refresh Tokens', { account });
    throw new APIError('EXPECTATION_FAILED', { message: 'Missing Access/Refresh Tokens' });
  }

  const driver = await createDriver(account.providerId, {});
  const userInfo = await driver
    .getUserInfo({
      access_token: account.accessToken,
      refresh_token: account.refreshToken,
      email: '',
    })
    .catch(() => {
      throw new APIError('UNAUTHORIZED', { message: 'Failed to get user info' });
    });

  if (!userInfo.data?.emailAddresses?.[0]?.value) {
    console.error('Missing email in user info:', { userInfo });
    throw new APIError('BAD_REQUEST', { message: 'Missing "email" in user info' });
  }

  const updatingInfo = {
    name: userInfo.data.names?.[0]?.displayName || 'Unknown',
    picture: userInfo.data.photos?.[0]?.url || '',
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    scope: driver.getScope(),
    expiresAt: new Date(Date.now() + (account.accessTokenExpiresAt?.getTime() || 3600000)),
  };

  await db
    .insert(connection)
    .values({
      providerId: account.providerId,
      id: crypto.randomUUID(),
      email: userInfo.data.emailAddresses[0].value,
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

const options = {
  database: drizzleAdapter(db, { provider: 'pg' }),
  advanced: {
    ipAddress: {
      disableIpTracking: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },
  socialProviders: getSocialProviders(),
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
      trustedProviders: ['google'],
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
      await resend.emails.send({
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
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=/settings/connections`;

      await resend.emails.send({
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
      const [foundUser] = await db
        .select({
          activeConnectionId: _user.defaultConnectionId,
          hasEarlyAccess: earlyAccess.isEarlyAccess,
          hasUsedTicket: earlyAccess.hasUsedTicket,
        })
        .from(_user)
        .leftJoin(earlyAccess, eq(_user.email, earlyAccess.email))
        .where(eq(_user.id, user.id))
        .limit(1);

      // Check early access and proceed
      if (
        !foundUser?.hasEarlyAccess &&
        process.env.NODE_ENV === 'production' &&
        process.env.EARLY_ACCESS_ENABLED
      ) {
        await db
          .insert(earlyAccess)
          .values({
            id: crypto.randomUUID(),
            email: user.email,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .catch((err) =>
            console.log('Tried to add user to earlyAccess after error, failed', foundUser, err),
          );
        try {
          throw redirect('/login?error=early_access_required');
        } catch (error) {
          console.warn('Error redirecting to login page:', error);
        }
      }

      let activeConnection = null;

      if (foundUser?.activeConnectionId) {
        // Get the active connection details
        const [connectionDetails] = await db
          .select()
          .from(connection)
          .where(eq(connection.id, foundUser.activeConnectionId))
          .limit(1);

        if (connectionDetails) {
          activeConnection = {
            id: connectionDetails.id,
            name: connectionDetails.name,
            email: connectionDetails.email,
            picture: connectionDetails.picture,
          };
        } else {
          await db
            .update(_user)
            .set({
              defaultConnectionId: null,
            })
            .where(eq(_user.id, user.id));
        }
      }

      if (!foundUser?.activeConnectionId) {
        const [defaultConnection] = await db
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
          const [userAccount] = await db
            .select()
            .from(account)
            .where(eq(account.userId, user.id))
            .limit(1);
          if (userAccount) {
            // create a new connection
            const [newConnection] = await db.insert(connection).values({
              id: crypto.randomUUID(),
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
            } as any);
            // this type error is pissing me tf off
            if (newConnection) {
              console.log('Created new connection for user', newConnection);
            }
          }
        }
      }

      return {
        connectionId: activeConnection?.id || null,
        activeConnection,
        user,
        session,
        hasUsedTicket: foundUser?.hasUsedTicket ?? false,
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
          const [existingSettings] = await db
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
            await db.insert(userSettings).values({
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
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') ?? [],
});
