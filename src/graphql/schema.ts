export const typeDefs = `#graphql
  scalar DateTime

  enum VenueRole {
    STAFF
    MANAGER
    OWNER
  }

  enum AttendeeStatus {
    GOING
    MAYBE
    NOT_GOING
  }

  type User {
    id: ID!
    email: String!
    name: String
    avatarUrl: String
    isSuperAdmin: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    communities: [CommunityMember!]!
    venueRoles: [VenueStaff!]!
    eventsCreated: [Event!]!
    eventsAttending: [EventAttendee!]!
  }

  type City {
    id: ID!
    name: String!
    state: String
    country: String!
    latitude: Float
    longitude: Float
    createdAt: DateTime!
    venues: [Venue!]!
    communities: [Community!]!
  }

  type Venue {
    id: ID!
    name: String!
    address: String!
    latitude: Float
    longitude: Float
    cityId: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    city: City!
    staff: [VenueStaff!]!
    events: [Event!]!
  }

  type VenueStaff {
    userId: String!
    venueId: String!
    role: VenueRole!
    createdAt: DateTime!
    user: User!
    venue: Venue!
  }

  type Community {
    id: ID!
    name: String!
    description: String
    imageUrl: String
    cityId: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    city: City!
    members: [CommunityMember!]!
    events: [Event!]!
    memberCount: Int!
  }

  type CommunityMember {
    userId: String!
    communityId: String!
    joinedAt: DateTime!
    user: User!
    community: Community!
  }

  type Event {
    id: ID!
    title: String!
    description: String
    startTime: DateTime!
    endTime: DateTime
    venueId: String!
    communityId: String!
    creatorId: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    venue: Venue!
    community: Community!
    creator: User!
    attendees: [EventAttendee!]!
    attendeeCount: Int!
  }

  type EventAttendee {
    userId: String!
    eventId: String!
    status: AttendeeStatus!
    joinedAt: DateTime!
    user: User!
    event: Event!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  # Inputs
  input SignUpInput {
    email: String!
    name: String
  }

  input CreateCityInput {
    name: String!
    state: String
    country: String!
    latitude: Float
    longitude: Float
  }

  input UpdateCityInput {
    name: String
    state: String
    country: String
    latitude: Float
    longitude: Float
  }

  input CreateVenueInput {
    name: String!
    address: String!
    cityId: String!
    latitude: Float
    longitude: Float
  }

  input UpdateVenueInput {
    name: String
    address: String
    latitude: Float
    longitude: Float
  }

  input CreateCommunityInput {
    name: String!
    description: String
    imageUrl: String
    cityId: String!
  }

  input UpdateCommunityInput {
    name: String
    description: String
    imageUrl: String
  }

  input CreateEventInput {
    title: String!
    description: String
    startTime: DateTime!
    endTime: DateTime
    venueId: String!
    communityId: String!
  }

  input UpdateEventInput {
    title: String
    description: String
    startTime: DateTime
    endTime: DateTime
  }

  input UpdateAttendeeStatusInput {
    eventId: String!
    status: AttendeeStatus!
  }

  # Pagination
  input PaginationInput {
    skip: Int
    take: Int
  }

  type Query {
    # User
    me: User
    user(id: ID!): User
    users(pagination: PaginationInput): [User!]!

    # City
    city(id: ID!): City
    cities(pagination: PaginationInput): [City!]!

    # Venue
    venue(id: ID!): Venue
    venues(cityId: ID, pagination: PaginationInput): [Venue!]!

    # Community
    community(id: ID!): Community
    communities(cityId: ID, pagination: PaginationInput): [Community!]!
    myCommunities: [Community!]!

    # Event
    event(id: ID!): Event
    events(
      venueId: ID
      communityId: ID
      upcoming: Boolean
      pagination: PaginationInput
    ): [Event!]!
    myEvents: [Event!]!
  }

  type Mutation {
    # Auth
    signInWithGoogle(idToken: String!): AuthPayload!
    signInWithApple(idToken: String!): AuthPayload!

    # User
    updateProfile(name: String, avatarUrl: String): User!
    deleteAccount: Boolean!

    # City (admin only)
    createCity(input: CreateCityInput!): City!
    updateCity(id: ID!, input: UpdateCityInput!): City!
    deleteCity(id: ID!): Boolean!

    # Venue
    createVenue(input: CreateVenueInput!): Venue!
    updateVenue(id: ID!, input: UpdateVenueInput!): Venue!
    deleteVenue(id: ID!): Boolean!
    addVenueStaff(venueId: ID!, userId: ID!, role: VenueRole!): VenueStaff!
    removeVenueStaff(venueId: ID!, userId: ID!): Boolean!

    # Community (create/update/delete require SUPER admin)
    createCommunity(input: CreateCommunityInput!): Community!
    updateCommunity(id: ID!, input: UpdateCommunityInput!): Community!
    deleteCommunity(id: ID!): Boolean!
    joinCommunity(communityId: ID!): CommunityMember!
    leaveCommunity(communityId: ID!): Boolean!
    removeCommunityMember(communityId: ID!, userId: ID!): Boolean!

    # Event
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, input: UpdateEventInput!): Event!
    deleteEvent(id: ID!): Boolean!
    updateAttendeeStatus(input: UpdateAttendeeStatusInput!): EventAttendee!
  }

  type Subscription {
    eventCreated(communityId: ID!): Event!
    eventUpdated(eventId: ID!): Event!
    attendeeStatusChanged(eventId: ID!): EventAttendee!
  }
`;
