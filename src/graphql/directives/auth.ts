import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { GraphQLSchema, defaultFieldResolver } from 'graphql';
import type { Context } from '../../context.js';
import { AuthenticationError, ForbiddenError } from '../../utils/errors.js';

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0];

      if (authDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig;
        const { requires } = authDirective;

        fieldConfig.resolve = async function (source, args, context: Context, info) {
          // Check if user is authenticated
          if (!context.user) {
            throw new AuthenticationError();
          }

          // If specific role is required, check for it
          if (requires) {
            // This could be extended to check for specific roles
            // For now, just having a user is enough
            const hasRole = await checkRole(context, requires);
            if (!hasRole) {
              throw new ForbiddenError(`Requires ${requires} role`);
            }
          }

          return resolve(source, args, context, info);
        };
      }

      return fieldConfig;
    },
  });
}

async function checkRole(context: Context, requiredRole: string): Promise<boolean> {
  const { user, prisma } = context;

  if (!user) return false;

  switch (requiredRole) {
    case 'VENUE_STAFF':
      // Check if user is staff at any venue
      const venueStaff = await prisma.venueStaff.findFirst({
        where: { userId: user.id },
      });
      return !!venueStaff;

    case 'COMMUNITY_ADMIN':
      // Check if user is admin of any community
      const communityMember = await prisma.communityMember.findFirst({
        where: { userId: user.id, role: 'ADMIN' },
      });
      return !!communityMember;

    case 'USER':
    default:
      // Any authenticated user
      return true;
  }
}

export const authDirectiveTypeDef = `
  directive @auth(requires: String) on FIELD_DEFINITION
`;
