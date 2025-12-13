// Disabled: React email components use @react-email/render which uses 'cache' in fetch
// CF Workers doesn't support 'cache' field. Re-enable when emails are pre-rendered.
// import {
//   AIWritingAssistantEmail,
//   AutoLabelingEmail,
//   CategoriesEmail,
//   Mail0ProEmail,
//   ShortcutsEmail,
//   SuperSearchEmail,
//   WelcomeEmail,
// } from './react-emails/email-sequences';
import { createAuthMiddleware, phoneNumber, jwt, bearer, mcp } from 'better-auth/plugins';
import { type Account, betterAuth, type BetterAuthOptions } from 'better-auth';
import { getBrowserTimezone, isValidTimezone } from './timezones';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getZeroDB, resetConnection } from './server-utils';
import { hashPassword, verifyPassword } from './auth-utils';
import { getSocialProviders } from './auth-providers';
import { redis, resend, twilio } from './services';
// import { dubAnalytics } from '@dub/better-auth'; // Disabled - uses 'cache' in fetch which CF Workers doesn't support
import { defaultUserSettings } from './schemas';
import { disableBrainFunction } from './brain';
import { APIError } from 'better-auth/api';
import { type EProviders } from '../types';
import type { HonoContext } from '../ctx';
import { createDriver } from './driver';
import { createDb } from '../db';
import { Effect } from 'effect';
import { env } from '../env';
import { Dub } from 'dub';

const scheduleCampaign = (userInfo: { address: string; name: string }) =>
  Effect.gen(function* () {
    const name = userInfo.name || 'there';
    const resendService = resend();

// Disabled: React email components use @react-email/render which uses 'cache' in fetch
// CF Workers doesn't support 'cache' field. Re-enable when emails are pre-rendered.
// const scheduleCampaign = (userInfo: { address: string; name: string }) =>
//   Effect.gen(function* () {
//     const name = userInfo.name || 'there';
//     const resendService = resend();
//
//     const sendEmail = (subject: string, react: unknown, scheduledAt?: string) =>
//       Effect.promise(() =>
//         resendService.emails
//           .send({
//             from: 'Nubo <onboarding@nubo.email>',
//             to: userInfo.address,
//             subject,
//             react: react as any,
//             ...(scheduledAt && { scheduledAt }),
//           })
//           .then(() => void 0),
//       );
//
//     const emails = [
//       {
//         subject: 'Welcome to Nubo',
//         react: WelcomeEmail({ name }),
//         scheduledAt: undefined,
//       },
//       {
//         subject: 'Mail0 Pro is here 🚀💼',
//         react: Mail0ProEmail({ name }),
//         scheduledAt: 'in 1 day',
//       },
//       {
//         subject: 'Auto-labeling is here 🎉📥',
//         react: AutoLabelingEmail({ name }),
//         scheduledAt: 'in 2 days',
//       },
//       {
//         subject: 'AI Writing Assistant is here 🤖💬',
//         react: AIWritingAssistantEmail({ name }),
//         scheduledAt: 'in 3 days',
//       },
//       {
//         subject: 'Shortcuts are here 🔧🚀',
//         react: ShortcutsEmail({ name }),
//         scheduledAt: 'in 4 days',
//       },
//       {
//         subject: 'Categories are here 📂🔍',
//         react: CategoriesEmail({ name }),
//         scheduledAt: 'in 5 days',
//       },
//       {
//         subject: 'Super Search is here 🔍🚀',
//         react: SuperSearchEmail({ name }),
//         scheduledAt: 'in 6 days',
//       },
//     ];
//
//     yield* Effect.all(
//       emails.map((email) => sendEmail(email.subject, email.react, email.scheduledAt)),
//       { concurrency: 'unbounded' },
//     );
//   });

// Generate a unique username from email
const generateUsername = (email: string): string => {
  // Extract the local part of the email (before @)
  const localPart = email.split('@')[0];
  // Clean it up: lowercase, only alphanumeric and underscores
  const cleaned = localPart.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_');
  // Ensure it's at least 3 characters
  const base = cleaned.length >= 3 ? cleaned : `${cleaned}user`;
  // Add random suffix to avoid collisions
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}_${suffix}`.substring(0, 30);
};

const connectionHandlerHook = async (account: Account) => {
  console.log('[connectionHandlerHook] START - Received account:', {
    id: account.id,
    accountId: account.accountId,
    providerId: account.providerId,
    userId: account.userId,
    hasAccessToken: !!account.accessToken,
    hasRefreshToken: !!account.refreshToken,
    accessTokenLength: account.accessToken?.length,
    refreshTokenLength: account.refreshToken?.length,
    accessTokenExpiresAt: account.accessTokenExpiresAt,
    // Debug: check if tokens are explicitly undefined vs just falsy
    accessTokenIsUndefined: account.accessToken === undefined,
    refreshTokenIsUndefined: account.refreshToken === undefined,
  });

  // Skip credential-based accounts (email/password sign-up)
  // Only process OAuth social provider accounts
  if (account.providerId === 'credential') {
    console.log('[connectionHandlerHook] Skipping credential provider');
    return;
  }

  // IMPORTANT: Only process if tokens are present
  // If this hook is triggered by an account update that doesn't include tokens,
  // we should NOT overwrite existing tokens in the connection table
  if (!account.accessToken || !account.refreshToken) {
    console.log('[connectionHandlerHook] No tokens in account update - SKIPPING to preserve existing connection tokens', {
      providerId: account.providerId,
      accountId: account.id,
    });
    return; // Don't throw error, just skip - this might be a non-token update
  }

  const driver = createDriver(account.providerId, {
    auth: {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      userId: account.userId,
      email: '',
    },
  });

  const userInfo = await driver.getUserInfo().catch(async () => {
    if (account.accessToken) {
      await driver.revokeToken(account.accessToken);
      await resetConnection(account.id);
    }
    throw new Response(null, { status: 301, headers: { Location: '/' } });
  });

  if (!userInfo?.address) {
    try {
      await Promise.allSettled(
        [account.accessToken, account.refreshToken]
          .filter(Boolean)
          .map((t) => driver.revokeToken(t as string)),
      );
      await resetConnection(account.id);
    } catch (error) {
      console.error('Failed to revoke tokens:', error);
    }
    throw new Response(null, { status: 303, headers: { Location: '/' } });
  }

  const updatingInfo = {
    name: userInfo.name || 'Unknown',
    picture: userInfo.photo || '',
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    scope: driver.getScope(),
    expiresAt: new Date(Date.now() + (account.accessTokenExpiresAt?.getTime() || 3600000)),
  };

  const db = await getZeroDB(account.userId);
  const [result] = await db.createConnection(
    account.providerId as EProviders,
    userInfo.address,
    updatingInfo,
  );

  // Disabled: React email components use @react-email/render which uses 'cache' in fetch
  // CF Workers doesn't support 'cache' field. Re-enable when emails are pre-rendered.
  // if (env.NODE_ENV === 'production') {
  //   // Run in background - don't block auth flow if email fails
  //   Effect.runPromise(
  //     scheduleCampaign({ address: userInfo.address, name: userInfo.name || 'there' }),
  //   ).catch((error) => {
  //     console.error('Failed to send onboarding emails:', error);
  //   });
  // }

  // Queue Gmail subscription if service account is configured and queue is available
  // Note: Only Google connections should be queued - Microsoft doesn't have subscription factory yet
  if (env.GOOGLE_S_ACCOUNT && env.GOOGLE_S_ACCOUNT !== '{}' && env.subscribe_queue && account.providerId === 'google') {
    await env.subscribe_queue.send({
      connectionId: result.id,
      providerId: account.providerId,
    });
  }
};

export const createAuth = () => {
  const twilioClient = twilio();
  // const dub = new Dub(); // Disabled - uses 'cache' in fetch which CF Workers doesn't support

  return betterAuth({
    plugins: [
      // dubAnalytics disabled - uses 'cache' in fetch which CF Workers doesn't support
      // dubAnalytics({
      //   dubClient: dub,
      // }),
      mcp({
        loginPage: env.VITE_PUBLIC_APP_URL + '/login',
      }),
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
        async sendDeleteAccountVerification(data) {
          const verificationUrl = data.url;

          await resend().emails.send({
            from: 'Nubo <no-reply@nubo.email>',
            to: data.user.email,
            subject: 'Delete your Nubo account',
            html: `
            <h2>Delete Your Nubo Account</h2>
            <p>Click the link below to delete your account:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
          `,
          });
        },
        beforeDelete: async (user, request) => {
          if (!request) throw new APIError('BAD_REQUEST', { message: 'Request object is missing' });
          const db = await getZeroDB(user.id);
          const connections = await db.findManyConnections();
          const context = getContext<HonoContext>();
          const customer = await context.var.autumn.customers.get(user.id);
          if (customer.data) {
            try {
              await Promise.all(
                customer.data.products.map(async (product) =>
                  context.var.autumn.cancel({
                    customer_id: user.id,
                    product_id: product.id,
                  }),
                ),
              );
            } catch (error) {
              console.error('Failed to delete Autumn customer:', error);
            }
          }

          const revokedAccounts = (
            await Promise.allSettled(
              connections.map(async (connection) => {
                if (!connection.accessToken || !connection.refreshToken) return false;
                await disableBrainFunction({
                  id: connection.id,
                  providerId: connection.providerId as EProviders,
                });
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

          await db.deleteUser();
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
      enabled: true,
      requireEmailVerification: true,
      password: {
        hash: hashPassword,
        verify: async ({ hash, password }) => verifyPassword(password, hash),
      },
      sendResetPassword: async ({ user, url }) => {
        await resend().emails.send({
          from: 'Nubo <no-reply@nubo.email>',
          to: user.email,
          subject: 'Reset your Nubo password',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Reset Your Password</h2>
              <p>You requested to reset your password. Click the button below to set a new password:</p>
              <a href="${url}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Reset Password</a>
              <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${url}">${url}</a></p>
              <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">This link will expire in 1 hour.</p>
            </div>
          `,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, token }) => {
        const verificationUrl = `${env.VITE_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&callbackURL=/settings/connections`;

        await resend().emails.send({
          from: 'Nubo <no-reply@nubo.email>',
          to: user.email,
          subject: 'Verify your Nubo account',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Welcome to Nubo!</h2>
              <p>Please verify your email address to complete your registration:</p>
              <a href="${verificationUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
              <p style="color: #666; font-size: 14px;">Or copy this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
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
            const db = await getZeroDB(newSession.user.id);
            const existingSettings = await db.findUserSettings();

            if (!existingSettings) {
              // get timezone from vercel's header
              const headerTimezone = ctx.headers?.get('x-vercel-ip-timezone');
              // validate timezone from header or fallback to browser timezone
              const timezone =
                headerTimezone && isValidTimezone(headerTimezone)
                  ? headerTimezone
                  : getBrowserTimezone();
              // write default settings against the user
              await db.insertUserSettings({
                ...defaultUserSettings,
                timezone,
              });
            }

            // Generate username if user doesn't have one
            const userRecord = await db.findUser();
            if (userRecord && !userRecord.username) {
              const username = generateUsername(newSession.user.email);
              try {
                await db.updateUser({ username });
              } catch {
                // Username collision - try with different suffix
                const retryUsername = generateUsername(newSession.user.email);
                await db.updateUser({ username: retryUsername }).catch(() => {
                  console.error('Failed to generate username for user:', newSession.user.id);
                });
              }
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
  const { db } = createDb(env.HYPERDRIVE.connectionString);
  return {
    database: drizzleAdapter(db, { provider: 'pg' }),
    secondaryStorage: {
      get: async (key: string) => {
        const value = await cache.get(key);
        return typeof value === 'string' ? value : value ? JSON.stringify(value) : null;
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
      'https://nubo.email',
      'https://api.nubo.email',
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
    onAPIError: {
      onError: (error) => {
        console.error('API Error', error);
      },
      errorURL: `${env.VITE_PUBLIC_APP_URL}/login`,
      throw: false, // Don't throw 500, redirect to errorURL instead
    },
  } satisfies BetterAuthOptions;
};

export const createSimpleAuth = () => {
  return betterAuth(createAuthConfig());
};

export type Auth = ReturnType<typeof createAuth>;
export type SimpleAuth = ReturnType<typeof createSimpleAuth>;
