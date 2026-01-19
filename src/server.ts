import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import cors from 'cors';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers/index.js';
import {
  authDirectiveTransformer,
  authDirectiveTypeDef,
  rateLimitDirectiveTransformer,
  rateLimitDirectiveTypeDef,
} from './graphql/directives/index.js';
import { createContext, type Context } from './context.js';
import { prisma } from './utils/prisma.js';

export async function createApolloServer() {
  // Create Express app and HTTP server
  const app = express();
  const httpServer = createServer(app);

  // Create executable schema with directive transformers
  let schema = makeExecutableSchema({
    typeDefs: [authDirectiveTypeDef, rateLimitDirectiveTypeDef, typeDefs],
    resolvers,
  });

  // Apply directive transformers
  schema = authDirectiveTransformer(schema);
  schema = rateLimitDirectiveTransformer(schema);

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Set up WebSocket server with graphql-ws
  const serverCleanup = useServer(
    {
      schema,
      context: async () => {
        // For subscriptions, we provide a minimal context
        // In production, you'd want to authenticate WebSocket connections
        return {
          prisma,
          user: null,
        };
      },
    },
    wsServer
  );

  // Create Apollo Server
  const server = new ApolloServer<Context>({
    schema,
    plugins: [
      // Proper shutdown for HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    introspection: process.env.NODE_ENV !== 'production',
    formatError: (formattedError, error) => {
      // Log errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('GraphQL Error:', error);
      }

      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        if (
          formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR' ||
          !formattedError.extensions?.code
        ) {
          return {
            message: 'An unexpected error occurred',
            extensions: {
              code: 'INTERNAL_SERVER_ERROR',
            },
          };
        }
      }

      return formattedError;
    },
  });

  // Start Apollo Server
  await server.start();

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Apply middleware
  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: process.env.CORS_ORIGIN?.split(',') || '*',
      credentials: true,
    }),
    express.json(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expressMiddleware(server as any, {
      context: async ({ req, res }) =>
        createContext({ req: req as unknown as Request, res: res as unknown as Response }),
    }) as any
  );

  return { app, httpServer, server };
}
