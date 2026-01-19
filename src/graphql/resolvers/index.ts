import { userResolvers } from './user.js';
import { cityResolvers } from './city.js';
import { venueResolvers } from './venue.js';
import { communityResolvers } from './community.js';
import { eventResolvers } from './event.js';
import { authResolvers } from './auth.js';
import { GraphQLScalarType, Kind } from 'graphql';

// DateTime scalar for handling dates
const dateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return new Date(value).toISOString();
    }
    throw new Error('DateTime cannot be serialized from a non-Date type');
  },
  parseValue(value: unknown): Date {
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    throw new Error('DateTime cannot be parsed from a non-string/number type');
  },
  parseLiteral(ast): Date | null {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      return new Date(ast.kind === Kind.INT ? parseInt(ast.value, 10) : ast.value);
    }
    return null;
  },
});

// Merge all resolvers
export const resolvers = {
  DateTime: dateTimeScalar,
  Query: {
    ...userResolvers.Query,
    ...cityResolvers.Query,
    ...venueResolvers.Query,
    ...communityResolvers.Query,
    ...eventResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...userResolvers.Mutation,
    ...cityResolvers.Mutation,
    ...venueResolvers.Mutation,
    ...communityResolvers.Mutation,
    ...eventResolvers.Mutation,
  },
  Subscription: {
    ...eventResolvers.Subscription,
  },
  User: userResolvers.User,
  City: cityResolvers.City,
  Venue: venueResolvers.Venue,
  VenueStaff: venueResolvers.VenueStaff,
  Community: communityResolvers.Community,
  CommunityMember: communityResolvers.CommunityMember,
  Event: eventResolvers.Event,
  EventAttendee: eventResolvers.EventAttendee,
};
