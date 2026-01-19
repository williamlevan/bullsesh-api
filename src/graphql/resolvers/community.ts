import type { MemberRole } from '@prisma/client';
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

async function getCommunityMemberRole(
  prisma: Context['prisma'],
  communityId: string,
  userId: string
): Promise<MemberRole | null> {
  const member = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });
  return member?.role ?? null;
}

async function isCommunityAdmin(
  prisma: Context['prisma'],
  communityId: string,
  userId: string
): Promise<boolean> {
  const role = await getCommunityMemberRole(prisma, communityId, userId);
  return role === 'ADMIN';
}

async function isCommunityModerator(
  prisma: Context['prisma'],
  communityId: string,
  userId: string
): Promise<boolean> {
  const role = await getCommunityMemberRole(prisma, communityId, userId);
  return role === 'ADMIN' || role === 'MODERATOR';
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
      if (!user) {
        throw new AuthenticationError();
      }

      // Verify city exists
      const city = await prisma.city.findUnique({ where: { id: input.cityId } });
      if (!city) {
        throw new NotFoundError('City', input.cityId);
      }

      // Create community and make creator the admin
      return prisma.community.create({
        data: {
          name: input.name,
          description: input.description,
          imageUrl: input.imageUrl,
          cityId: input.cityId,
          members: {
            create: {
              userId: user.id,
              role: 'ADMIN',
            },
          },
        },
      });
    },

    updateCommunity: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateCommunityInput },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const community = await prisma.community.findUnique({ where: { id } });
      if (!community) {
        throw new NotFoundError('Community', id);
      }

      // Only admins can update community settings
      const isAdmin = await isCommunityAdmin(prisma, id, user.id);
      if (!isAdmin) {
        throw new ForbiddenError('Only community admins can update community settings');
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
      if (!user) {
        throw new AuthenticationError();
      }

      const community = await prisma.community.findUnique({ where: { id } });
      if (!community) {
        throw new NotFoundError('Community', id);
      }

      // Only admins can delete
      const isAdmin = await isCommunityAdmin(prisma, id, user.id);
      if (!isAdmin) {
        throw new ForbiddenError('Only community admins can delete the community');
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
          role: 'MEMBER',
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

      // Check if user is the only admin
      if (member.role === 'ADMIN') {
        const adminCount = await prisma.communityMember.count({
          where: { communityId, role: 'ADMIN' },
        });

        if (adminCount === 1) {
          throw new ForbiddenError(
            'Cannot leave community as the only admin. Transfer ownership first.'
          );
        }
      }

      await prisma.communityMember.delete({
        where: { userId_communityId: { userId: user.id, communityId } },
      });

      return true;
    },

    updateMemberRole: async (
      _: unknown,
      { communityId, userId, role }: { communityId: string; userId: string; role: MemberRole },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      // Only admins can change roles
      const isAdmin = await isCommunityAdmin(prisma, communityId, user.id);
      if (!isAdmin) {
        throw new ForbiddenError('Only community admins can change member roles');
      }

      // Cannot change own role
      if (userId === user.id) {
        throw new ForbiddenError('Cannot change your own role');
      }

      const member = await prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId } },
      });

      if (!member) {
        throw new NotFoundError('Member');
      }

      return prisma.communityMember.update({
        where: { userId_communityId: { userId, communityId } },
        data: { role },
      });
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

export { isCommunityAdmin, isCommunityModerator, getCommunityMemberRole };
