import { GraphQLError } from 'graphql';

export class AuthenticationError extends GraphQLError {
  constructor(message = 'Not authenticated') {
    super(message, {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'Not authorized') {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id ${id} not found` : `${resource} not found`, {
      extensions: {
        code: 'NOT_FOUND',
        http: { status: 404 },
      },
    });
  }
}

export class ValidationError extends GraphQLError {
  constructor(message: string, field?: string) {
    super(message, {
      extensions: {
        code: 'BAD_USER_INPUT',
        field,
        http: { status: 400 },
      },
    });
  }
}

export class ConflictError extends GraphQLError {
  constructor(message: string) {
    super(message, {
      extensions: {
        code: 'CONFLICT',
        http: { status: 409 },
      },
    });
  }
}

export class RateLimitError extends GraphQLError {
  constructor(message = 'Too many requests') {
    super(message, {
      extensions: {
        code: 'TOO_MANY_REQUESTS',
        http: { status: 429 },
      },
    });
  }
}
