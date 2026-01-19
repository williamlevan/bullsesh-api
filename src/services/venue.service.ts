import { z } from 'zod';
import type { PrismaClient, VenueRole } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

// Validation schemas
export const createVenueSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  cityId: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateVenueSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;

export class VenueService {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.venue.findUnique({
      where: { id },
    });
  }

  async findAll(cityId?: string, skip = 0, take = 50) {
    return this.prisma.venue.findMany({
      where: cityId ? { cityId } : undefined,
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  async isStaff(venueId: string, userId: string, requiredRoles?: VenueRole[]) {
    const staff = await this.prisma.venueStaff.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });

    if (!staff) return false;
    if (!requiredRoles) return true;
    return requiredRoles.includes(staff.role);
  }

  async create(userId: string, input: CreateVenueInput) {
    const validatedInput = createVenueSchema.parse(input);

    // Verify city exists
    const city = await this.prisma.city.findUnique({
      where: { id: validatedInput.cityId },
    });
    if (!city) {
      throw new NotFoundError('City', validatedInput.cityId);
    }

    // Create venue and make creator the owner
    return this.prisma.venue.create({
      data: {
        name: validatedInput.name,
        address: validatedInput.address,
        cityId: validatedInput.cityId,
        latitude: validatedInput.latitude,
        longitude: validatedInput.longitude,
        staff: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
    });
  }

  async update(venueId: string, userId: string, input: UpdateVenueInput) {
    const validatedInput = updateVenueSchema.parse(input);

    const venue = await this.findById(venueId);
    if (!venue) {
      throw new NotFoundError('Venue', venueId);
    }

    // Only managers and owners can update
    const canUpdate = await this.isStaff(venueId, userId, ['MANAGER', 'OWNER']);
    if (!canUpdate) {
      throw new ForbiddenError('Only venue managers or owners can update the venue');
    }

    return this.prisma.venue.update({
      where: { id: venueId },
      data: {
        ...(validatedInput.name !== undefined && { name: validatedInput.name }),
        ...(validatedInput.address !== undefined && { address: validatedInput.address }),
        ...(validatedInput.latitude !== undefined && { latitude: validatedInput.latitude }),
        ...(validatedInput.longitude !== undefined && { longitude: validatedInput.longitude }),
      },
    });
  }

  async delete(venueId: string, userId: string) {
    const venue = await this.findById(venueId);
    if (!venue) {
      throw new NotFoundError('Venue', venueId);
    }

    // Only owners can delete
    const canDelete = await this.isStaff(venueId, userId, ['OWNER']);
    if (!canDelete) {
      throw new ForbiddenError('Only venue owners can delete the venue');
    }

    // Check for existing events
    const eventCount = await this.prisma.event.count({ where: { venueId } });
    if (eventCount > 0) {
      throw new ConflictError('Cannot delete venue with existing events. Delete events first.');
    }

    await this.prisma.venue.delete({ where: { id: venueId } });
    return true;
  }

  async addStaff(venueId: string, actorId: string, targetUserId: string, role: VenueRole) {
    // Only owners can add staff
    const canManage = await this.isStaff(venueId, actorId, ['OWNER']);
    if (!canManage) {
      throw new ForbiddenError('Only venue owners can add staff');
    }

    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    return this.prisma.venueStaff.upsert({
      where: { userId_venueId: { userId: targetUserId, venueId } },
      create: { userId: targetUserId, venueId, role },
      update: { role },
    });
  }

  async removeStaff(venueId: string, actorId: string, targetUserId: string) {
    // Only owners can remove staff
    const canManage = await this.isStaff(venueId, actorId, ['OWNER']);
    if (!canManage) {
      throw new ForbiddenError('Only venue owners can remove staff');
    }

    // Cannot remove yourself as owner
    if (targetUserId === actorId) {
      throw new ForbiddenError('Cannot remove yourself as owner');
    }

    const member = await this.prisma.venueStaff.findUnique({
      where: { userId_venueId: { userId: targetUserId, venueId } },
    });

    if (!member) {
      throw new NotFoundError('Staff member');
    }

    await this.prisma.venueStaff.delete({
      where: { userId_venueId: { userId: targetUserId, venueId } },
    });

    return true;
  }

  async getStaff(venueId: string) {
    return this.prisma.venueStaff.findMany({
      where: { venueId },
      include: { user: true },
    });
  }

  async getEvents(venueId: string) {
    return this.prisma.event.findMany({
      where: { venueId },
      orderBy: { startTime: 'desc' },
    });
  }
}
