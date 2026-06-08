import {
  getOrCreateUserProfile,
  updateUserProfile,
} from '../../services/user-profile-service';
import { privateProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import jwt from '@tsndr/cloudflare-worker-jwt';
import { z } from 'zod';

const userProfileSchema = z.object({
  userId: z.string(),
  name: z.string(),
  occupation: z.string(),
  affiliation: z.array(z.string()),
  interest: z.array(z.string()),
});

export const userRouter = router({
  getProfile: privateProcedure.output(userProfileSchema).query(async ({ ctx }) => {
    try {
      const profile = await getOrCreateUserProfile(
        ctx.c.env,
        ctx.sessionUser.id,
        ctx.sessionUser.name,
      );

      return {
        userId: profile.userId,
        name: profile.name,
        occupation: profile.occupation,
        affiliation: profile.affiliation,
        interest: profile.interest,
      };
    } catch (error) {
      console.error('[USER_PROFILE] Failed to load profile', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load user profile',
      });
    }
  }),
  saveProfile: privateProcedure
    .input(
      z.object({
        occupation: z.string(),
        affiliation: z.array(z.string()),
        interest: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const profile = await updateUserProfile(
          ctx.c.env,
          ctx.sessionUser.id,
          input,
          ctx.sessionUser.name,
        );

        return {
          success: true,
          profile: {
            userId: profile.userId,
            name: profile.name,
            occupation: profile.occupation,
            affiliation: profile.affiliation,
            interest: profile.interest,
          },
        };
      } catch (error) {
        console.error('[USER_PROFILE] Failed to save profile', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save user profile',
        });
      }
    }),
  delete: privateProcedure.mutation(async ({ ctx }) => {
    const { success, message } = await ctx.c.var.auth.api.deleteUser({
      body: {
        callbackURL: '/',
      },
      headers: ctx.c.req.raw.headers,
      request: ctx.c.req.raw,
    });
    return { success, message };
  }),
  getIntercomToken: privateProcedure.query(async ({ ctx }) => {
    const token = await jwt.sign(
      {
        user_id: ctx.sessionUser.id,
        email: ctx.sessionUser.email,
      },
      ctx.c.env.JWT_SECRET,
    );
    return token;
  }),
});
