/* eslint-disable @typescript-eslint/no-explicit-any */
import { connection, user as _user, account } from "@zero/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { getSocialProviders } from "./auth-providers";
import { customSession } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@zero/db";

// If there is no resend key, it might be a local dev environment
// In that case, we don't want to send emails and just log them
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : { emails: { send: async (...args: any[]) => console.log(args) } };

const options = {
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
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
  emailAndPassword: {
    enabled: false,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await resend.emails.send({
        from: "0.email <onboarding@0.email>",
        to: user.email,
        subject: "Reset your password",
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
        from: "0.email <onboarding@0.email>",
        to: user.email,
        subject: "Verify your 0.email account",
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
        })
        .from(_user)
        .where(eq(_user.id, user.id))
        .limit(1);
      if (!foundUser?.activeConnectionId) {
        const [defaultConnection] = await db
          .select()
          .from(connection)
          .where(eq(connection.userId, user.id))
          .limit(1);
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
              console.log("Created new connection for user", newConnection);
            }
          }
        }
        return {
          connectionId: defaultConnection ? defaultConnection.id : null,
          user,
          session,
        };
      }

      return {
        connectionId: foundUser?.activeConnectionId,
        user,
        session,
      };
    }),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ?? [],
});
