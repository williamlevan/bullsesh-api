import type { Context } from '../../context.js';
import { AuthenticationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';

function requireSuperAdmin(user: Context['user']): void {
  if (!user) {
    throw new AuthenticationError();
  }
  if (!user.isSuperAdmin) {
    throw new ForbiddenError('Only super admins can perform this action');
  }
}

interface CreateCityInput {
  name: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface UpdateCityInput {
  name?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export const cityResolvers = {
  Query: {
    city: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
      return prisma.city.findUnique({
        where: { id },
      });
    },

    cities: async (
      _: unknown,
      { pagination }: { pagination?: { skip?: number; take?: number } },
      { prisma }: Context
    ) => {
      return prisma.city.findMany({
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 50,
        orderBy: { name: 'asc' },
      });
    },
  },

  Mutation: {
    createCity: async (
      _: unknown,
      { input }: { input: CreateCityInput },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      return prisma.city.create({
        data: {
          name: input.name,
          state: input.state,
          country: input.country,
          latitude: input.latitude,
          longitude: input.longitude,
        },
      });
    },

    updateCity: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateCityInput },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      const city = await prisma.city.findUnique({ where: { id } });
      if (!city) {
        throw new NotFoundError('City', id);
      }

      return prisma.city.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.state !== undefined && { state: input.state }),
          ...(input.country !== undefined && { country: input.country }),
          ...(input.latitude !== undefined && { latitude: input.latitude }),
          ...(input.longitude !== undefined && { longitude: input.longitude }),
        },
      });
    },

    deleteCity: async (
      _: unknown,
      { id }: { id: string },
      { user, prisma }: Context
    ) => {
      requireSuperAdmin(user);

      const city = await prisma.city.findUnique({ where: { id } });
      if (!city) {
        throw new NotFoundError('City', id);
      }

      await prisma.city.delete({ where: { id } });
      return true;
    },
  },

  City: {
    venues: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.venue.findMany({
        where: { cityId: parent.id },
        orderBy: { name: 'asc' },
      });
    },

    communities: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.community.findMany({
        where: { cityId: parent.id },
        orderBy: { name: 'asc' },
      });
    },
  },
};
