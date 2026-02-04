import { z } from 'zod';
import type { PrismaClient, AttendeeStatus } from '@prisma/client';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { pubsub, EVENTS } from '../graphql/resolvers/event.js';

// Validation schemas
export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date().optional(),
  venueId: z.string().min(1),
  communityId: z.string().min(1),
}).refine(
  (data) => {
    if (data.endTime) {
      return data.endTime > data.startTime;
    }
    return true;
  },
  { message: 'End time must be after start time' }
);

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional().nullable(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export class EventService {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  async findAll(options: {
    venueId?: string;
    communityId?: string;
    cityId?: string;
    upcoming?: boolean;
    skip?: number;
    take?: number;
  }) {
    const { venueId, communityId, cityId, upcoming, skip = 0, take = 50 } = options;

    return this.prisma.event.findMany({
      where: {
        ...(venueId && { venueId }),
        ...(communityId && { communityId }),
        ...(cityId && { venue: { cityId } }),
        ...(upcoming && { startTime: { gte: new Date() } }),
      },
      skip,
      take,
      orderBy: { startTime: upcoming ? 'asc' : 'desc' },
    });
  }

  private async isVenueStaff(venueId: string, userId: string): Promise<boolean> {
    const staff = await this.prisma.venueStaff.findUnique({
      where: { userId_venueId: { userId, venueId } },
    });
    return !!staff;
  }

  private async canManageEvent(eventId: string, userId: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        venue: {
          include: { staff: true },
        },
      },
    });

    if (!event) return false;

    // Creator can manage
    if (event.creatorId === userId) return true;

    // Venue owner can manage
    const ownerStaff = event.venue.staff.find(
      (s) => s.userId === userId && s.role === 'OWNER'
    );
    return !!ownerStaff;
  }

  async create(userId: string, input: CreateEventInput) {
    const validatedInput = createEventSchema.parse(input);

    // Verify venue exists
    const venue = await this.prisma.venue.findUnique({
      where: { id: validatedInput.venueId },
    });
    if (!venue) {
      throw new NotFoundError('Venue', validatedInput.venueId);
    }

    // Verify community exists
    const community = await this.prisma.community.findUnique({
      where: { id: validatedInput.communityId },
    });
    if (!community) {
      throw new NotFoundError('Community', validatedInput.communityId);
    }

    // User must be venue staff to create events
    const isStaff = await this.isVenueStaff(validatedInput.venueId, userId);
    if (!isStaff) {
      throw new ForbiddenError('Only venue staff can create events at this venue');
    }

    // Event start time must be in the future
    if (validatedInput.startTime < new Date()) {
      throw new ValidationError('Event start time must be in the future');
    }

    const event = await this.prisma.event.create({
      data: {
        title: validatedInput.title,
        description: validatedInput.description,
        startTime: validatedInput.startTime,
        endTime: validatedInput.endTime,
        venueId: validatedInput.venueId,
        communityId: validatedInput.communityId,
        creatorId: userId,
      },
    });

    // Publish event for subscriptions
    pubsub.publish(`${EVENTS.EVENT_CREATED}.${validatedInput.communityId}`, {
      eventCreated: event,
    });

    return event;
  }

  async update(eventId: string, userId: string, input: UpdateEventInput) {
    const validatedInput = updateEventSchema.parse(input);

    const event = await this.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event', eventId);
    }

    // Check if user can manage this event
    const canManage = await this.canManageEvent(eventId, userId);
    if (!canManage) {
      throw new ForbiddenError('Only event creator or venue owner can update this event');
    }

    // Validate times
    const newStartTime = validatedInput.startTime ?? event.startTime;
    const newEndTime = validatedInput.endTime ?? event.endTime;

    if (newEndTime && newEndTime <= newStartTime) {
      throw new ValidationError('End time must be after start time');
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(validatedInput.title !== undefined && { title: validatedInput.title }),
        ...(validatedInput.description !== undefined && { description: validatedInput.description }),
        ...(validatedInput.startTime !== undefined && { startTime: validatedInput.startTime }),
        ...(validatedInput.endTime !== undefined && { endTime: validatedInput.endTime }),
      },
    });

    // Publish update for subscriptions
    pubsub.publish(`${EVENTS.EVENT_UPDATED}.${eventId}`, {
      eventUpdated: updatedEvent,
    });

    return updatedEvent;
  }

  async delete(eventId: string, userId: string) {
    const event = await this.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event', eventId);
    }

    // Check if user can manage this event
    const canManage = await this.canManageEvent(eventId, userId);
    if (!canManage) {
      throw new ForbiddenError('Only event creator or venue owner can delete this event');
    }

    await this.prisma.event.delete({ where: { id: eventId } });
    return true;
  }

  async updateAttendeeStatus(
    eventId: string,
    userId: string,
    status: AttendeeStatus
  ) {
    const event = await this.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event', eventId);
    }

    const attendee = await this.prisma.eventAttendee.upsert({
      where: { userId_eventId: { userId, eventId } },
      create: { userId, eventId, status },
      update: { status },
    });

    // Publish status change for subscriptions
    pubsub.publish(`${EVENTS.ATTENDEE_STATUS_CHANGED}.${eventId}`, {
      attendeeStatusChanged: attendee,
    });

    return attendee;
  }

  async getAttendees(eventId: string) {
    return this.prisma.eventAttendee.findMany({
      where: { eventId },
      include: { user: true },
    });
  }

  async getAttendeeCount(eventId: string) {
    return this.prisma.eventAttendee.count({
      where: { eventId, status: 'GOING' },
    });
  }

  async getUserEvents(userId: string) {
    const attendances = await this.prisma.eventAttendee.findMany({
      where: { userId, status: 'GOING' },
      include: { event: true },
      orderBy: { event: { startTime: 'asc' } },
    });
    return attendances.map((a) => a.event);
  }
}
