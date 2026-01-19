# Bullsesh API

Production GraphQL API backend for the Bullsesh application.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **GraphQL Server**: Apollo Server 4
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Auth**: JWT + passport (Google/Apple OAuth)
- **Real-time**: GraphQL Subscriptions (WebSocket)
- **Caching**: Apollo Cache + Redis
- **Rate Limiting**: graphql-rate-limit
- **Validation**: zod

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `APPLE_*` - Apple Sign-In credentials
- `REDIS_URL` - Redis connection string

## Project Structure

- `src/index.ts` - Entry point
- `src/server.ts` - Apollo Server setup
- `src/context.ts` - GraphQL context (auth, db)
- `src/auth/` - Authentication handlers (JWT, Google, Apple OAuth)
- `src/graphql/` - Schema, resolvers, and directives
- `src/services/` - Business logic layer
- `src/utils/` - Utilities (Redis, errors)
- `prisma/` - Database schema and migrations

## Railway Deployment

### Initial Setup

1. Link to existing Railway project:
```bash
railway link
```

2. Add PostgreSQL and Redis services in Railway dashboard, then connect them to your project.

3. Set environment variables in Railway dashboard:
   - `JWT_SECRET` - Generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY`
   - `NODE_ENV=production`

   Note: `DATABASE_URL` and `REDIS_URL` are auto-injected by Railway when you add those services.

4. Deploy:
```bash
railway up
```

### Subsequent Deployments

```bash
# Deploy latest changes
railway up

# Or push to GitHub (if connected for auto-deploy)
git push origin main
```

### Run Migrations on Railway

```bash
railway run npm run prisma:deploy
```

### Useful Commands

```bash
# View logs
railway logs

# Open Railway dashboard
railway open

# Run one-off commands
railway run <command>
```
