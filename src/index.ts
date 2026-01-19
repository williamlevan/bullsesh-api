import 'dotenv/config';
import { createApolloServer } from './server.js';
import { redis } from './utils/redis.js';

const PORT = process.env.PORT || 4000;

async function main() {
  try {
    // Connect to Redis (lazy connect)
    await redis.connect().catch((err: Error) => {
      console.warn('Redis connection failed, caching disabled:', err.message);
    });

    // Create and start server
    const { httpServer } = await createApolloServer();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
      console.log(`🔌 WebSocket ready at ws://localhost:${PORT}/graphql`);
      console.log(`❤️  Health check at http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);

      httpServer.close(() => {
        console.log('HTTP server closed');
      });

      await redis.quit().catch(() => {});
      console.log('Redis connection closed');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
