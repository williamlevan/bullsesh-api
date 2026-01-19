Project Structure

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

Key Features Implemented

- GraphQL API with Apollo Server 4, Express, and WebSocket subscriptions
- Database with Prisma ORM (PostgreSQL) - 8 models with relations
- Authentication via Google/Apple OAuth with JWT tokens
- Authorization - venue staff can create events, community admins manage settings
- Real-time - GraphQL subscriptions for event updates
- Rate limiting - Redis-backed directive for mutation protection
- Input validation - zod schemas in service layer
- Docker - production-ready multi-stage Dockerfile

Getting Started

# Start dependencies
  docker-compose -f docker-compose.dev.yml up -d

# Run migrations
  npx prisma migrate dev

# Start development server
  npm run dev

The server will be available at:
  - GraphQL: http://localhost:4000/graphql
  - WebSocket: ws://localhost:4000/graphql
  - Health: http://localhost:4000/health