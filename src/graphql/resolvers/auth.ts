import type { Context } from '../../context.js';
import { signToken } from '../../auth/jwt.js';
import { verifyGoogleToken } from '../../auth/google.js';
import { verifyAppleToken } from '../../auth/apple.js';
import { ValidationError, ForbiddenError } from '../../utils/errors.js';

export const authResolvers = {
  Mutation: {
    devCreateUser: async (
      _: unknown,
      { email, name, isSuperAdmin }: { email: string; name?: string; isSuperAdmin?: boolean },
      { prisma }: Context
    ) => {
      // Only allow in development
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenError('This mutation is only available in development');
      }

      if (!email) {
        throw new ValidationError('Email is required');
      }

      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            name,
            isSuperAdmin: isSuperAdmin ?? false,
          },
        });
      } else if (isSuperAdmin !== undefined) {
        // Update existing user's super admin status if specified
        user = await prisma.user.update({
          where: { email },
          data: { isSuperAdmin },
        });
      }

      // Generate JWT
      const token = signToken({
        userId: user.id,
        email: user.email,
      });

      return {
        token,
        user,
      };
    },

    signInWithGoogle: async (
      _: unknown,
      { idToken }: { idToken: string },
      { prisma }: Context
    ) => {
      if (!idToken) {
        throw new ValidationError('Google ID token is required');
      }

      // Verify the Google token
      const googleUser = await verifyGoogleToken(idToken);

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { googleId: googleUser.googleId },
            { email: googleUser.email },
          ],
        },
      });

      if (user) {
        // Update Google ID if user signed up with email but now using Google
        if (!user.googleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              googleId: googleUser.googleId,
              avatarUrl: user.avatarUrl ?? googleUser.avatarUrl,
              name: user.name ?? googleUser.name,
            },
          });
        }
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            googleId: googleUser.googleId,
            name: googleUser.name,
            avatarUrl: googleUser.avatarUrl,
          },
        });
      }

      // Generate JWT
      const token = signToken({
        userId: user.id,
        email: user.email,
      });

      return {
        token,
        user,
      };
    },

    signInWithApple: async (
      _: unknown,
      { idToken }: { idToken: string },
      { prisma }: Context
    ) => {
      if (!idToken) {
        throw new ValidationError('Apple ID token is required');
      }

      // Verify the Apple token
      const appleUser = await verifyAppleToken(idToken);

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { appleId: appleUser.appleId },
            { email: appleUser.email },
          ],
        },
      });

      if (user) {
        // Update Apple ID if user signed up with email but now using Apple
        if (!user.appleId) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              appleId: appleUser.appleId,
            },
          });
        }
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            email: appleUser.email,
            appleId: appleUser.appleId,
            name: appleUser.name,
          },
        });
      }

      // Generate JWT
      const token = signToken({
        userId: user.id,
        email: user.email,
      });

      return {
        token,
        user,
      };
    },
  },
};
