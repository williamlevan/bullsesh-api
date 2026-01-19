import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors.js';

// Validation schemas
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findAll(skip = 0, take = 20) {
    return this.prisma.user.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    // Validate input
    const validatedInput = updateProfileSchema.parse(input);

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(validatedInput.name !== undefined && { name: validatedInput.name }),
        ...(validatedInput.avatarUrl !== undefined && { avatarUrl: validatedInput.avatarUrl }),
      },
    });
  }

  async deleteAccount(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });

    return true;
  }

  async getUserCommunities(userId: string) {
    return this.prisma.communityMember.findMany({
      where: { userId },
      include: { community: true },
    });
  }

  async getUserVenueRoles(userId: string) {
    return this.prisma.venueStaff.findMany({
      where: { userId },
      include: { venue: true },
    });
  }

  async getUserCreatedEvents(userId: string) {
    return this.prisma.event.findMany({
      where: { creatorId: userId },
      orderBy: { startTime: 'desc' },
    });
  }

  async getUserAttendingEvents(userId: string) {
    return this.prisma.eventAttendee.findMany({
      where: { userId },
      include: { event: true },
    });
  }
}
