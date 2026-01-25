# BullSesh API Documentation

## Project Structure

bullsesh-api/
  ├── src/
  │   ├── index.ts                  # Entry point with graceful shutdown
  │   ├── server.ts                 # Apollo Server with Express & WebSockets
  │   ├── context.ts                # GraphQL context with auth
  │   ├── auth/
  │   │   ├── jwt.ts                # JWT sign/verify utilities
  │   │   ├── google.ts             # Google OAuth token verification
  │   │   └── apple.ts              # Apple Sign-In verification
  │   ├── graphql/
  │   │   ├── schema.ts             # GraphQL type definitions
  │   │   ├── resolvers/            # Query/Mutation/Subscription resolvers
  │   │   │   ├── user.ts, city.ts, venue.ts, community.ts, event.ts, auth.ts
  │   │   └── directives/
  │   │       ├── auth.ts           # @auth directive
  │   │       └── rateLimit.ts      # @rateLimit directive (Redis-backed)
  │   ├── services/                 # Business logic with zod validation
  │   │   ├── user.service.ts, city.service.ts, venue.service.ts
  │   │   ├── community.service.ts, event.service.ts
  │   └── utils/
  │       ├── prisma.ts             # Prisma client singleton (Prisma 7 adapter)
  │       ├── redis.ts              # Redis client with cache helpers
  │       └── errors.ts             # Custom GraphQL error types
  ├── prisma/
  │   ├── schema.prisma             # All data models (User, City, Venue, etc.)
  │   └── prisma.config.ts          # Prisma 7 configuration
  ├── Dockerfile                    # Multi-stage production build
  ├── docker-compose.yml            # Full stack deployment
  └── docker-compose.dev.yml        # Development dependencies

---

## Key Features Implemented

- GraphQL API with Apollo Server 4, Express, and WebSocket subscriptions
- Database with Prisma ORM (PostgreSQL) - 8 models with relations
- Authentication via Google/Apple OAuth with JWT tokens
- Authorization - venue staff can create events, community admins manage settings
- Real-time - GraphQL subscriptions for event updates
- Rate limiting - Redis-backed directive for mutation protection
- Input validation - zod schemas in service layer
- Docker - production-ready multi-stage Dockerfile

---

## Getting Started

### Start dependencies
- `docker-compose -f docker-compose.dev.yml up -d`

### Run migrations
- `npx prisma migrate dev`

### Start development server
- `npm run dev`

The server will be available at:
- GraphQL: `http://localhost:4000/graphql`
- WebSocket: `ws://localhost:4000/graphql`
- Health: `http://localhost:4000/health`

--- 

## GraphQL Endpoints

### Authentication

#### Mutation: `signInWithGoogle(idToken)`
Description: Sign in/up with Google OAuth token
Returns: `AuthPayload { token, user }`

#### Mutation: `signInWithApple(idToken)`
Description: Sign in/up with Apple ID token
Returns: `AuthPayload { token, user }`

### User

#### Query: `me`
Description: Get current logged-in user

#### Query `user(id)`
Description: Get user by ID

#### Query: `users(pagination)`
Description: List all users

#### Mutation: `updateProfile(name, avatarUrl)`
Description: Update your profile (as of now, you can only update these two fields)
**Auth required**

#### Mutation: `deleteAccount`
Description: Delete your account
**Auth required**

### City

#### Query: `city(id)`
Description: Get city by ID

#### Query: `cities(pagination)`
Description: List all cities

#### Mutation: `createCity(input)`
Description: Create a new city
**Auth required**

#### Mutation: `updateCity(id, input)`
Description: Update a new city
**Auth required**

#### Mutation: `deleteCity(id)`
Description: Delete a city (if no venues/communities)
**Auth required**

### Venue

#### Query: `venue(id)`
Description: Get venue by ID

#### Query: `venues(cityId, pagination)`
Description: List venues (optionally, filter by city)

#### Mutation: `createVenue(input)`
Description: Create a venue
**Auth required (SUPER)**

#### Mutation: `updateVenue(id, input)`
Description: Update venue
**Auth required (MANAGER / OWNER)**

#### Mutation: `deleteVenue(id)`
Description: Delete venue
**Auth required (OWNER)**

#### Mutation: `addVenueStaff(venueId, userId, role)`
Description: Add staff member
**Auth required (OWNER)**
Roles: `STAFF`, `MANAGER`, `OWNER`

#### Mutation: `removeVenueStaff(venueId, userId)`
Description: Remove staff member
**Auth required (OWNER)**

### Community

#### Query: `community(id)`
Description: Get community by ID

#### Query: `communities(cityId, pagination)`
Description: List communities

#### Query: myCommunities
Description: List communities you're a member of
**Auth required**

#### Mutation: `createCommunity(input)`
Description: Create community
**Auth required (SUPER)**

#### Mutation: `updateCommunity(id, input)`
Description: Update community settings
**Auth required (SUPER)**

#### Mutation: `deleteCommunity(id)`
Description: Delete community
**Auth required (SUPER)**

#### Mutation: `joinCommunity(communityId)`
Description: Join a community (for a user)
**Auth required**

#### Mutation: `leaveCommunity(communityId)`
Description: Leave a community (for a user)
**Auth required**

### Event

#### Query: `event(id)`
Description: Get event by ID

#### Query: `events(venueId, communityId, upcoming, pagination)`
Description: List events with filters

#### Query: `myEvents`
Description: List events you're attending (`GOING` status)
**Auth required**

#### Mutation: `createEvent(input)`
Description: Create event at a venue
**Auth required (Venue STAFF / MANAGER / OWNER)**

#### Mutation: `updateEvent(id, input)`
Description: Update event
**Auth required (Creator or venue OWNER)**

#### Mutation: `deleteEvent(id)`
Description: Delete event
**Auth required (Creator or venue OWNER)**

#### Mutation: `updateAttendeeStatus(input)`
Description: RSCP to the event
**Auth required**
Attendee status: `GOING`, `MAYBE`, `NOT_GOING`

### Subscriptions (WebSockets)

#### Subscription: `eventCreated(communityId)`
Description: New event in a community
Use case: Live feed of new events

#### Subscription: `eventDeleted(communityId)`
Description: Event deleted in a community
Use case: Live feed of new events

#### Subscription: `eventUpdated(eventId)`
Description: Event details changed
Use case: Update event page in real-time

#### Subscription: `attendeeStatusChanges(eventId)`
Description: Someone RSVPs
Use case: Live attendee count

---

## Authorization Summary

| Action | Who Can Do It |
| --- | --- |
| Create event at venue | Venue `STAFF`, `MANAGER`, or `OWNER` |
| Update/delete event | Event creator or venue `OWNER` |
| Update venue | Venue `MANAGER`, or `OWNER` |
| Delete venue / manage staff | Venue `OWNER` |
| Update community settings | Domain `SUPER` |
| Change member roles | Domain `SUPER` |
| Create / delete community | Domain `SUPER` |

---

## Data Structures

### User

| Field | Type | Description |
| --- | --- | --- |
| `id` | String | Primary key (unique) |
| `email` | String | Email address (unique) |
| `name` | String | Display name |
| `avatarUrl` | String? | Profile image URL |
| `googleId` | String? | Google OAuth ID (unique) |
| `appleId` | String? | Apple Sign-In ID (unique) |
| `isSuperAdmin` | Boolean | Domain-level admin privileges |
| `createdAt` | DateTime | Account creation time |
| `updatedAt` | DateTime | Last update time |

#### Relations:
- `communities` -> `CommunityMember[]` (communities user belongs to)
- `venueRoles` -> `VenueStaff[]` (venues user manages)
- `eventsCreated` -> `Event[]` (events user created)
- `eventsAttending` -> `EventAttendee[]` (event RSVPs)

### City

| Field | Type | Description |
| --- | --- | --- |
| `id` | String | Primary key (unique) |
| `name` | String | City name |
| `state` | String? | State/province |
| `country` | String | Country |
| `latitude` | Float? | GPS latitude |
| `longitude` | Float? | GPS longitude |
| `createdAt` | DateTime | Creation time |

#### Relations:
- `venues` -> `Venue[]` (venues in this city)
- `communities` -> `Community[]` (communities in this city)

### Venue

| Field | Type | Description |
| --- | --- | --- |
| `id` | String | Primary key (unique) |
| `name` | String | Venue name |
| `address` | String | Street address |
| `latitude` | Float | GPS latitude |
| `longitude` | Float | GPS longitude |
| `cityId` | String | Foreign key to City |
| `createdAt` | DateTime | Creation time |
| `updatedAt` | DateTime | Last updated time |

#### Relations:
- `city` -> `City` (city this venue is in)
- `staff` -> `VenueStaff[]` (staff members)
- `events` -> `Event[]` (events at this venue)

### VenueStaff (Join Table)

| Field | Type | Description |
| --- | --- | --- |
| `userId` | String | Foreign key to User |
| `venueId` | String | Foreign key to Venue |
| `role` | VenueRole (enum) | `STAFF`, `MANAGER`, or `OWNER` |
| `createdAt` | DateTime | When staff was added |

### Community

| Field | Type | Description |
| --- | --- | --- |
| `id` | String | Primary key (unique) |
| `name` | String | Community name |
| `description` | String? | About the community |
| `imageUrl` | String? | Community image/logo |
| `cityId` | String | Foreign key to City |
| `createdAt` | DateTime | Creation time |
| `updatedAt` | DateTime | Last update time |

#### Relations:
- `city` -> `City` (city this community is in)
- `members` -> `CommunityMember[]` (community members)
- `events` -> `Event[]` (community events)

### CommunityMember (Join Table)

| Field | Type | Description |
| --- | --- | --- |
| `userId` | String | Foreign key to User |
| `communityId` | String | Foreign key to Community |
| `joinedAt` | DateTime | When user joined |

### Event

| Field | Type | Description |
| --- | --- | --- |
| `id` | String | Primary key (unique) |
| `title` | String | Event title |
| `description` | String? | Event details |
| `startTime` | DateTime | Event start time |
| `endTime` | DateTime? | Event end time |
| `venueId` | String | Foreign key to Venue |
| `communityId` | String | Foreign key to Community |
| `creatorId` | String | Foreign key to User (creator) |
| `createdAt` | String | Creation time |
| `updatedAt` | String | Last update time |

#### Relations
- `venue` -> `Venue` (where event takes place)
- `community` -> `Community` (which community hosts it)
- `creator` -> `User` (who created the event)
- `attendees` -> `EventAttendee[]` (RSVPs)

### Event Attendee (Join Table)

| Field | Type | Description |
| --- | --- | --- |
| `userId` | String | Foreign key to User |
| `userId` | String | Foreign key to Event |
| `userId` | AttendeeStatus (enum) | `GOING`, `MAYBE`, or `NOT_GOING` |
| `userId` | DateTime | When user RSVPed |

## To Run

*** Prerequisites
- Node.js (18+)
- PostgreSQL
- Redis

### Setup

1. **Install dependencies**
`npm install`

2. **Configure environment variables**
Copy .env.example to .env and set:
DATABASE_URL="postgresql://USERNAME@localhost:5432/bullsesh?schema=public"                    
REDIS_URL="redis://localhost:6379"             
JWT_SECRET="your-secret-key"                   
API_KEY="your-api-key"

#### macOS with Homebrew
`brew services start postgresql@14`
`brew services start redis`

#### Or use Docker
`docker-compose -f docker-compose.dev.yml up -d`

3. Create database
`createdb bullsesh`

4. Generate Prisma client
`npm run prisma:generate`

5. Run migrations
`npx prisma migrate dev --name init`

6. Start development server
`npm run dev`

### Endpoints
- GraphQL: http://localhost:4000/graphql       
- WebSocket: ws://localhost:4000/graphql       
- Health Check: http://localhost:4000/health