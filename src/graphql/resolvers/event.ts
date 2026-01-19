import type { AttendeeStatus } from '@prisma/client';
import type { Context } from '../../context.js';
import { AuthenticationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import { PubSub } from 'graphql-subscriptions';

// Create a PubSub instance for subscriptions
export const pubsub = new PubSub();

// Subscription event names
export const EVENTS = {
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
  ATTENDEE_STATUS_CHANGED: 'ATTENDEE_STATUS_CHANGED',
};

interface CreateEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  venueId: string;
  communityId: string;
}

interface UpdateEventInput {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
}

interface UpdateAttendeeStatusInput {
  eventId: string;
  status: AttendeeStatus;
}

async function isVenueStaff(
  prisma: Context['prisma'],
  venueId: string,
  userId: string
): Promise<boolean> {
  const staff = await prisma.venueStaff.findUnique({
    where: { userId_venueId: { userId, venueId } },
  });
  return !!staff;
}

async function canManageEvent(
  prisma: Context['prisma'],
  eventId: string,
  userId: string
): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      venue: {
        include: {
          staff: true,
        },
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

export const eventResolvers = {
  Query: {
    event: async (_: unknown, { id }: { id: string }, { prisma }: Context) => {
      return prisma.event.findUnique({
        where: { id },
      });
    },

    events: async (
      _: unknown,
      {
        venueId,
        communityId,
        upcoming,
        pagination,
      }: {
        venueId?: string;
        communityId?: string;
        upcoming?: boolean;
        pagination?: { skip?: number; take?: number };
      },
      { prisma }: Context
    ) => {
      return prisma.event.findMany({
        where: {
          ...(venueId && { venueId }),
          ...(communityId && { communityId }),
          ...(upcoming && { startTime: { gte: new Date() } }),
        },
        skip: pagination?.skip ?? 0,
        take: pagination?.take ?? 50,
        orderBy: { startTime: upcoming ? 'asc' : 'desc' },
      });
    },

    myEvents: async (_: unknown, __: unknown, { user, prisma }: Context) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const attendances = await prisma.eventAttendee.findMany({
        where: { userId: user.id, status: 'GOING' },
        include: { event: true },
        orderBy: { event: { startTime: 'asc' } },
      });

      return attendances.map((a) => a.event);
    },
  },

  Mutation: {
    createEvent: async (
      _: unknown,
      { input }: { input: CreateEventInput },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      // Verify venue exists
      const venue = await prisma.venue.findUnique({ where: { id: input.venueId } });
      if (!venue) {
        throw new NotFoundError('Venue', input.venueId);
      }

      // Verify community exists
      const community = await prisma.community.findUnique({ where: { id: input.communityId } });
      if (!community) {
        throw new NotFoundError('Community', input.communityId);
      }

      // User must be venue staff to create events at this venue
      const isStaff = await isVenueStaff(prisma, input.venueId, user.id);
      if (!isStaff) {
        throw new ForbiddenError('Only venue staff can create events at this venue');
      }

      const event = await prisma.event.create({
        data: {
          title: input.title,
          description: input.description,
          startTime: input.startTime,
          endTime: input.endTime,
          venueId: input.venueId,
          communityId: input.communityId,
          creatorId: user.id,
        },
      });

      // Publish event for subscriptions
      pubsub.publish(`${EVENTS.EVENT_CREATED}.${input.communityId}`, {
        eventCreated: event,
      });

      return event;
    },

    updateEvent: async (
      _: unknown,
      { id, input }: { id: string; input: UpdateEventInput },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) {
        throw new NotFoundError('Event', id);
      }

      // Check if user can manage this event
      const canManage = await canManageEvent(prisma, id, user.id);
      if (!canManage) {
        throw new ForbiddenError('Only event creator or venue owner can update this event');
      }

      const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.startTime !== undefined && { startTime: input.startTime }),
          ...(input.endTime !== undefined && { endTime: input.endTime }),
        },
      });

      // Publish update for subscriptions
      pubsub.publish(`${EVENTS.EVENT_UPDATED}.${id}`, {
        eventUpdated: updatedEvent,
      });

      return updatedEvent;
    },

    deleteEvent: async (
      _: unknown,
      { id }: { id: string },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) {
        throw new NotFoundError('Event', id);
      }

      // Check if user can manage this event
      const canManage = await canManageEvent(prisma, id, user.id);
      if (!canManage) {
        throw new ForbiddenError('Only event creator or venue owner can delete this event');
      }

      await prisma.event.delete({ where: { id } });
      return true;
    },

    updateAttendeeStatus: async (
      _: unknown,
      { input }: { input: UpdateAttendeeStatusInput },
      { user, prisma }: Context
    ) => {
      if (!user) {
        throw new AuthenticationError();
      }

      const event = await prisma.event.findUnique({ where: { id: input.eventId } });
      if (!event) {
        throw new NotFoundError('Event', input.eventId);
      }

      const attendee = await prisma.eventAttendee.upsert({
        where: { userId_eventId: { userId: user.id, eventId: input.eventId } },
        create: {
          userId: user.id,
          eventId: input.eventId,
          status: input.status,
        },
        update: {
          status: input.status,
        },
      });

      // Publish status change for subscriptions
      pubsub.publish(`${EVENTS.ATTENDEE_STATUS_CHANGED}.${input.eventId}`, {
        attendeeStatusChanged: attendee,
      });

      return attendee;
    },
  },

  Subscription: {
    eventCreated: {
      subscribe: (_: unknown, { communityId }: { communityId: string }) => {
        return pubsub.asyncIterableIterator(`${EVENTS.EVENT_CREATED}.${communityId}`);
      },
    },

    eventUpdated: {
      subscribe: (_: unknown, { eventId }: { eventId: string }) => {
        return pubsub.asyncIterableIterator(`${EVENTS.EVENT_UPDATED}.${eventId}`);
      },
    },

    attendeeStatusChanged: {
      subscribe: (_: unknown, { eventId }: { eventId: string }) => {
        return pubsub.asyncIterableIterator(`${EVENTS.ATTENDEE_STATUS_CHANGED}.${eventId}`);
      },
    },
  },

  Event: {
    venue: async (parent: { venueId: string }, _: unknown, { prisma }: Context) => {
      return prisma.venue.findUnique({
        where: { id: parent.venueId },
      });
    },

    community: async (parent: { communityId: string }, _: unknown, { prisma }: Context) => {
      return prisma.community.findUnique({
        where: { id: parent.communityId },
      });
    },

    creator: async (parent: { creatorId: string }, _: unknown, { prisma }: Context) => {
      return prisma.user.findUnique({
        where: { id: parent.creatorId },
      });
    },

    attendees: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.eventAttendee.findMany({
        where: { eventId: parent.id },
        include: { user: true },
      });
    },

    attendeeCount: async (parent: { id: string }, _: unknown, { prisma }: Context) => {
      return prisma.eventAttendee.count({
        where: { eventId: parent.id, status: 'GOING' },
      });
    },
  },

  EventAttendee: {
    user: async (parent: { userId: string }, _: unknown, { prisma }: Context) => {
      return prisma.user.findUnique({
        where: { id: parent.userId },
      });
    },

    event: async (parent: { eventId: string }, _: unknown, { prisma }: Context) => {
      return prisma.event.findUnique({
        where: { id: parent.eventId },
      });
    },
  },
};
