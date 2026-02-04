import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLSchema, defaultFieldResolver } from 'graphql';
import type { Context } from '../../context.js';
import { redis } from '../../utils/redis.js';
import { RateLimitError } from '../../utils/errors.js';

interface RateLimitConfig {
  max: number;
  window: string;
}

// Parse window string to seconds (e.g., "1m" -> 60, "1h" -> 3600)
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) return 60; // Default 1 minute

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 60;
  }
}

export function rateLimitDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const rateLimitDirective = getDirective(schema, fieldConfig, 'rateLimit')?.[0] as
        | RateLimitConfig
        | undefined;

      if (rateLimitDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        const { max, window } = rateLimitDirective;
        const windowSeconds = parseWindow(window);

        fieldConfig.resolve = async function (source, args, context: Context, info) {
          // Skip rate limiting if Redis is not configured
          if (redis) {
            // Create a unique key based on user or IP
            const identifier = context.user?.id || context.req.ip || 'anonymous';
            const fieldName = info.fieldName;
            const key = `ratelimit:${fieldName}:${identifier}`;

            try {
              // Get current count
              const current = await redis.get(key);
              const count = current ? parseInt(current, 10) : 0;

              if (count >= max) {
                throw new RateLimitError(
                  `Rate limit exceeded. Maximum ${max} requests per ${window}`
                );
              }

              // Increment counter
              const pipeline = redis.pipeline();
              pipeline.incr(key);
              if (!current) {
                pipeline.expire(key, windowSeconds);
              }
              await pipeline.exec();
            } catch (error) {
              // If Redis is unavailable, allow the request but log the error
              if (!(error instanceof RateLimitError)) {
                console.warn('Rate limiting unavailable:', error);
              } else {
                throw error;
              }
            }
          }

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
}

export const rateLimitDirectiveTypeDef = `
  directive @rateLimit(max: Int!, window: String!) on FIELD_DEFINITION
`;
