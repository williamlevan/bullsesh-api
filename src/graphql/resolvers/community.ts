import type { Context } from '../../context.js';
import { AuthenticationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';

interface CreateCommunityInput {
  name: string;
  description?: string;
  imageUrl?: string;
  cityId: string;
}

interface UpdateCommunityInput {
  name?: string;
  description?: string;
  imageUrl?: string;
}

function requireSuperAdmin(user: Context['user']): void {
  if (!user) {
    throw new AuthenticationError();
  }
  if (!user.isSuperAdmin) {
    throw new ForbiddenError('Only super admins can perform this action');
  }
}

export const communityResolvers = {
  Query: {
    community: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
      return prisma.community.findUnique({
        where: { id },
      });
    },

    communities: async (
      _: unknown,
      {
        cityId,
        pagination,
      }: { cityId?: string; pagination?: { skip?: number; take?: number } },
      { prisma }: Context
    ) => {
      return prisma.community.findMany({
        where: cityId ? { cityId } : undefined,
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 50,
        orderBy: { name: 'asc' },
      });
    },

    myCommunities: async (_: unknown, __: unknown, { user, prisma }: Context) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const memberships = await prisma.communityMember.findMany({
        where: { userId: user.id },
        include: { community: true },
      });

      return memberships.map((m) => m.community);
    },
  },

  Mutation: {
    createCommunity: async (
      _: unknown,
      { input }: { input: CreateCommunityInput },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      // Verify city exists
      const city = await prisma.city.findUnique({ where: { id: input.cityId } });
      if (!city) {
        throw new NotFoundError('City', input.cityId);
      }

      return prisma.community.create({
        data: {
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
          cityId: input.cityId,
        },
      });
    },

    updateCommunity: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateCommunityInput },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      const community = await prisma.community.findUnique({ where: { id } });
      if (!community) {
        throw new NotFoundError('Community', id);
      }

      return prisma.community.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
        },
      });
    },

    deleteCommunity: async (
      _: unknown,
      { id }: { id: string },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      const community = await prisma.community.findUnique({ where: { id } });
      if (!community) {
        throw new NotFoundError('Community', id);
      }

      await prisma.community.delete({ where: { id } });
      return true;
    },

    joinCommunity: async (
      _: unknown,
      { communityId }: { communityId: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const community = await prisma.community.findUnique({ where: { id: communityId } });
      if (!community) {
        throw new NotFoundError('Community', communityId);
      }

      // Check if already a member
      const existingMember = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: user.id, communityId } },
      });

      if (existingMember) {
        return existingMember;
      }

      return prisma.communityMember.create({
        data: {
          userId: user.id,
          communityId,
        },
      });
    },

    leaveCommunity: async (
      _: unknown,
      { communityId }: { communityId: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const member = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId: user.id, communityId } },
      });

      if (!member) {
        throw new NotFoundError('Membership');
      }

      await prisma.communityMember.delete({
        where: { userId_communityId: { userId: user.id, communityId } },
      });

      return true;
    },

    removeCommunityMember: async (
      _: unknown,
      { communityId, userId }: { communityId: string; userId: string },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      const member = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });

      if (!member) {
        throw new NotFoundError('Member');
      }

      await prisma.communityMember.delete({
        where: { userId_communityId: { userId, communityId } },
      });

      return true;
    },
  },

  Community: {
    city: async (parent: { cityId: string }, _: unknown, { prisma }: Context) => {
      return prisma.city.findUnique({
        where: { id: parent.cityId },
      });
    },

    members: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.communityMember.findMany({
        where: { communityId: parent.id },
        include: { user: true },
      });
    },

    events: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.event.findMany({
        where: { communityId: parent.id },
        orderBy: { startTime: 'desc' },
      });
    },

    memberCount: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.communityMember.count({
        where: { communityId: parent.id },
      });
    },
  },

  CommunityMember: {
    user: async (parent: { userId: string }, _: unknown, { prisma }: Context) => {
      return prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },

    community: async (parent: { communityId: string }, _: unknown, { prisma }: Context) => {
      return prisma.community.findUnique({
        where: { id: parent.communityId },
      });
    },
  },
};
