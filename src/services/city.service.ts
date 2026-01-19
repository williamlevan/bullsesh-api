import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '../utils/errors.js';

// Validation schemas
export const createCitySchema = z.object({
  name: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateCitySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().min(1).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type CreateCityInput = z.infer<typeof createCitySchema>;
export type UpdateCityInput = z.infer<typeof updateCitySchema>;

export class CityService {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.city.findUnique({
      where: { id },
    });
  }

  async findAll(skip = 0, take = 50) {
    return this.prisma.city.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  async create(input: CreateCityInput) {
    const validatedInput = createCitySchema.parse(input);

    // Check for duplicate city
    const existing = await this.prisma.city.findFirst({
      where: {
        name: validatedInput.name,
        country: validatedInput.country,
        state: validatedInput.state ?? null,
      },
    });

    if (existing) {
      throw new ConflictError('City already exists');
    }

    return this.prisma.city.create({
      data: validatedInput,
    });
  }

  async update(id: string, input: UpdateCityInput) {
    const validatedInput = updateCitySchema.parse(input);

    const city = await this.findById(id);
    if (!city) {
      throw new NotFoundError('City', id);
    }

    return this.prisma.city.update({
      where: { id },
      data: {
        ...(validatedInput.name !== undefined && { name: validatedInput.name }),
        ...(validatedInput.state !== undefined && { state: validatedInput.state }),
        ...(validatedInput.country !== undefined && { country: validatedInput.country }),
        ...(validatedInput.latitude !== undefined && { latitude: validatedInput.latitude }),
        ...(validatedInput.longitude !== undefined && { longitude: validatedInput.longitude }),
      },
    });
  }

  async delete(id: string) {
    const city = await this.findById(id);
    if (!city) {
      throw new NotFoundError('City', id);
    }

    // Check for existing venues or communities
    const [venueCount, communityCount] = await Promise.all([
      this.prisma.venue.count({ where: { cityId: id } }),
      this.prisma.community.count({ where: { cityId: id } }),
    ]);

    if (venueCount > 0 || communityCount > 0) {
      throw new ConflictError(
        'Cannot delete city with existing venues or communities. Delete them first.'
      );
    }

    await this.prisma.city.delete({ where: { id } });
    return true;
  }

  async getVenues(cityId: string) {
    return this.prisma.venue.findMany({
      where: { cityId },
      orderBy: { name: 'asc' },
    });
  }

  async getCommunities(cityId: string) {
    return this.prisma.community.findMany({
      where: { cityId },
      orderBy: { name: 'asc' },
    });
  }
}
