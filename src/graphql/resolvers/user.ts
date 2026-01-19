import type { Context } from '../../context.js';
import { AuthenticationError } from '../../utils/errors.js';

export const userResolvers = {
  Query: {
    me: async (_: unknown, __: unknown, { user }: Context) => {
      return user;
    },

    user: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
      return prisma.user.findUnique({
        where: { id },
      });
    },

    users: async (
      _: unknown,
      { pagination }: { pagination?: { skip?: number; take?: number } },
      { prisma }: Context
    ) => {
      return prisma.user.findMany({
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 20,
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Mutation: {
    updateProfile: async (
      _: unknown,
      { name, avatarUrl }: { name?: string; avatarUrl?: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      return prisma.user.update({
        where: { id: user.id },
        data: {
          ...(name !== undefined && { name }),
          ...(avatarUrl !== undefined && { avatarUrl }),
        },
      });
    },

    deleteAccount: async (_: unknown, __: unknown, { user, prisma }: Context) => {
      if (!user) {
        throw new AuthenticationError();
      }

      await prisma.user.delete({
        where: { id: user.id },
      });

      return true;
    },
  },

  User: {
    communities: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.communityMember.findMany({
        where: { userId: parent.id },
        include: { community: true },
      });
    },

    venueRoles: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.venueStaff.findMany({
        where: { userId: parent.id },
        include: { venue: true },
      });
    },

    eventsCreated: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.event.findMany({
        where: { creatorId: parent.id },
        orderBy: { startTime: 'desc' },
      });
    },

    eventsAttending: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.eventAttendee.findMany({
        where: { userId: parent.id },
        include: { event: true },
      });
    },
  },
};
