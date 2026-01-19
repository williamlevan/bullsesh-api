import type { Request, Response } from 'express';
import type { PrismaClient, User } from '@prisma/client';
import { prisma } from './utils/prisma.js';
import { verifyToken, type JwtPayload } from './auth/jwt.js';

export interface Context {
  prisma: PrismaClient;
  user: User | null;
  req: Request;
  res: Response;
}

export interface AuthenticatedContext extends Context {
  user: User;
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  let user: User | null = null;

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = verifyToken(token) as JwtPayload;
      if (payload?.userId) {
        user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
      }
    } catch {
      // Token invalid or expired - user remains null
    }
  }

  return {
    prisma,
    user,
    req,
    res,
  };
}
