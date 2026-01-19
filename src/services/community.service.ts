import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

// Validation schemas
export const createCommunitySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().max(500).optional(),
  cityId: z.string().min(1),
});

export const updateCommunitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().max(500).optional().nullable(),
});

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;

export class CommunityService {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.community.findUnique({
      where: { id },
    });
  }

  async findAll(cityId?: string, skip = 0, take = 50) {
    return this.prisma.community.findMany({
      where: cityId ? { cityId } : undefined,
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }

  async isMember(communityId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    return !!member;
  }

  async create(input: CreateCommunityInput) {
    const validatedInput = createCommunitySchema.parse(input);

    // Verify city exists
    const city = await this.prisma.city.findUnique({
      where: { id: validatedInput.cityId },
    });
    if (!city) {
      throw new NotFoundError('City', validatedInput.cityId);
    }

    return this.prisma.community.create({
      data: {
        name: validatedInput.name,
        description: validatedInput.description,
        imageUrl: validatedInput.imageUrl,
        cityId: validatedInput.cityId,
      },
    });
  }

  async update(communityId: string, input: UpdateCommunityInput) {
    const validatedInput = updateCommunitySchema.parse(input);

    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    return this.prisma.community.update({
      where: { id: communityId },
      data: {
        ...(validatedInput.name !== undefined && { name: validatedInput.name }),
        ...(validatedInput.description !== undefined && { description: validatedInput.description }),
        ...(validatedInput.imageUrl !== undefined && { imageUrl: validatedInput.imageUrl }),
      },
    });
  }

  async delete(communityId: string) {
    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    await this.prisma.community.delete({ where: { id: communityId } });
    return true;
  }

  async join(communityId: string, userId: string) {
    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Check if already a member
    const existingMember = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (existingMember) {
      return existingMember;
    }

    return this.prisma.communityMember.create({
      data: {
        userId,
        communityId,
      },
    });
  }

  async leave(communityId: string, userId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!member) {
      throw new NotFoundError('Membership');
    }

    await this.prisma.communityMember.delete({
      where: { userId_communityId: { userId, communityId } },
    });

    return true;
  }

  async removeMember(communityId: string, targetUserId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!member) {
      throw new NotFoundError('Member');
    }

    await this.prisma.communityMember.delete({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    return true;
  }

  async getMembers(communityId: string) {
    return this.prisma.communityMember.findMany({
      where: { communityId },
      include: { user: true },
    });
  }

  async getEvents(communityId: string) {
    return this.prisma.event.findMany({
      where: { communityId },
      orderBy: { startTime: 'desc' },
    });
  }

  async getMemberCount(communityId: string) {
    return this.prisma.communityMember.count({
      where: { communityId },
    });
  }

  async getUserCommunities(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: { community: true },
    });
    return memberships.map((m) => m.community);
  }
}
