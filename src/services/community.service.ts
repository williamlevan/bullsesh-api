import { z } from 'zod';
import type { PrismaClient, MemberRole } from '@prisma/client';
import { NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';

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

  async getMemberRole(communityId: string, userId: string): Promise<MemberRole | null> {
    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });
    return member?.role ?? null;
  }

  async isAdmin(communityId: string, userId: string): Promise<boolean> {
    const role = await this.getMemberRole(communityId, userId);
    return role === 'ADMIN';
  }

  async isModerator(communityId: string, userId: string): Promise<boolean> {
    const role = await this.getMemberRole(communityId, userId);
    return role === 'ADMIN' || role === 'MODERATOR';
  }

  async create(userId: string, input: CreateCommunityInput) {
    const validatedInput = createCommunitySchema.parse(input);

    // Verify city exists
    const city = await this.prisma.city.findUnique({
      where: { id: validatedInput.cityId },
    });
    if (!city) {
      throw new NotFoundError('City', validatedInput.cityId);
    }

    // Create community and make creator the admin
    return this.prisma.community.create({
      data: {
        name: validatedInput.name,
        description: validatedInput.description,
        imageUrl: validatedInput.imageUrl,
        cityId: validatedInput.cityId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
    });
  }

  async update(communityId: string, userId: string, input: UpdateCommunityInput) {
    const validatedInput = updateCommunitySchema.parse(input);

    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Only admins can update community settings
    const isAdmin = await this.isAdmin(communityId, userId);
    if (!isAdmin) {
      throw new ForbiddenError('Only community admins can update community settings');
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

  async delete(communityId: string, userId: string) {
    const community = await this.findById(communityId);
    if (!community) {
      throw new NotFoundError('Community', communityId);
    }

    // Only admins can delete
    const isAdmin = await this.isAdmin(communityId, userId);
    if (!isAdmin) {
      throw new ForbiddenError('Only community admins can delete the community');
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
        role: 'MEMBER',
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

    // Check if user is the only admin
    if (member.role === 'ADMIN') {
      const adminCount = await this.prisma.communityMember.count({
        where: { communityId, role: 'ADMIN' },
      });

      if (adminCount === 1) {
        throw new ForbiddenError(
          'Cannot leave community as the only admin. Transfer ownership first.'
        );
      }
    }

    await this.prisma.communityMember.delete({
      where: { userId_communityId: { userId, communityId } },
    });

    return true;
  }

  async updateMemberRole(
    communityId: string,
    actorId: string,
    targetUserId: string,
    role: MemberRole
  ) {
    // Only admins can change roles
    const isAdmin = await this.isAdmin(communityId, actorId);
    if (!isAdmin) {
      throw new ForbiddenError('Only community admins can change member roles');
    }

    // Cannot change own role
    if (targetUserId === actorId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const member = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: targetUserId, communityId } },
    });

    if (!member) {
      throw new NotFoundError('Member');
    }

    return this.prisma.communityMember.update({
      where: { userId_communityId: { userId: targetUserId, communityId } },
      data: { role },
    });
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
