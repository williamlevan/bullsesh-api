import type { VenueRole } from '@prisma/client';
import type { Context } from '../../context.js';
import { AuthenticationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';

interface CreateVenueInput {
  name: string;
  address: string;
  cityId: string;
  latitude?: number;
  longitude?: number;
}

interface UpdateVenueInput {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

async function isVenueStaff(
  prisma: Context['prisma'],
  venueId: string,
  userId: string,
  requiredRoles?: VenueRole[]
): Promise<boolean> {
  const staff = await prisma.venueStaff.findUnique({
    where: { userId_venueId: { userId, venueId } },
  });

  if (!staff) return false;
  if (!requiredRoles) return true;
  return requiredRoles.includes(staff.role);
}

export const venueResolvers = {
  Query: {
    venue: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
      return prisma.venue.findUnique({
        where: { id },
      });
    },

    venues: async (
      _: unknown,
      {
        cityId,
        pagination,
      }: { cityId?: string; pagination?: { skip?: number; take?: number } },
      { prisma }: Context
    ) => {
      return prisma.venue.findMany({
        where: cityId ? { cityId } : undefined,
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 50,
        orderBy: { name: 'asc' },
      });
    },
  },

  Mutation: {
    createVenue: async (
      _: unknown,
      { input }: { input: CreateVenueInput },
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

      // Create venue and make creator the owner
      return prisma.venue.create({
        data: {
          name: input.name,
          address: input.address,
          cityId: input.cityId,
          latitude: input.latitude,
          longitude: input.longitude,
          staff: {
            create: {
              userId: user.id,
              role: 'OWNER',
            },
          },
        },
      });
    },

    updateVenue: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateVenueInput },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const venue = await prisma.venue.findUnique({ where: { id } });
      if (!venue) {
        throw new NotFoundError('Venue', id);
      }

      // Only managers and owners can update
      const canUpdate = await isVenueStaff(prisma, id, user.id, ['MANAGER', 'OWNER']);
      if (!canUpdate) {
        throw new ForbiddenError('Only venue managers or owners can update the venue');
      }

      return prisma.venue.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.latitude !== undefined && { latitude: input.latitude }),
          ...(input.longitude !== undefined && { longitude: input.longitude }),
        },
      });
    },

    deleteVenue: async (
      _: unknown,
      { id }: { id: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const venue = await prisma.venue.findUnique({ where: { id } });
      if (!venue) {
        throw new NotFoundError('Venue', id);
      }

      // Only owners can delete
      const canDelete = await isVenueStaff(prisma, id, user.id, ['OWNER']);
      if (!canDelete) {
        throw new ForbiddenError('Only venue owners can delete the venue');
      }

      await prisma.venue.delete({ where: { id } });
      return true;
    },

    addVenueStaff: async (
      _: unknown,
      { venueId, userId, role }: { venueId: string; userId: string; role: VenueRole },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      // Only owners can add staff
      const canManage = await isVenueStaff(prisma, venueId, user.id, ['OWNER']);
      if (!canManage) {
        throw new ForbiddenError('Only venue owners can add staff');
      }

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser) {
        throw new NotFoundError('User', userId);
      }

      return prisma.venueStaff.upsert({
        where: { userId_venueId: { userId, venueId } },
        create: { userId, venueId, role },
        update: { role },
      });
    },

    removeVenueStaff: async (
      _: unknown,
      { venueId, userId }: { venueId: string; userId: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      // Only owners can remove staff
      const canManage = await isVenueStaff(prisma, venueId, user.id, ['OWNER']);
      if (!canManage) {
        throw new ForbiddenError('Only venue owners can remove staff');
      }

      // Cannot remove yourself as owner
      if (userId === user.id) {
        throw new ForbiddenError('Cannot remove yourself as owner');
      }

      await prisma.venueStaff.delete({
        where: { userId_venueId: { userId, venueId } },
      });
      return true;
    },
  },

  Venue: {
    city: async (parent: { cityId: string }, _: unknown, { prisma }: Context) => {
      return prisma.city.findUnique({
        where: { id: parent.cityId },
      });
    },

    staff: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.venueStaff.findMany({
        where: { venueId: parent.id },
        include: { user: true },
      });
    },

    events: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.event.findMany({
        where: { venueId: parent.id },
        orderBy: { startTime: 'desc' },
      });
    },
  },

  VenueStaff: {
    user: async (parent: { userId: string }, _: unknown, { prisma }: Context) => {
      return prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },

    venue: async (parent: { venueId: string }, _: unknown, { prisma }: Context) => {
      return prisma.venue.findUnique({
        where: { id: parent.venueId },
      });
    },
  },
};
