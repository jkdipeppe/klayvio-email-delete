import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import type { PrismaClient } from '@prisma/client';

export interface AuthRequest extends Request {
  userId?: string;
  user?: { id: string; email: string; name: string | null; picture: string | null };
}

export function authMiddleware(prisma: PrismaClient) {
  /** Parse Bearer token and attach user. Does not block if missing. */
  async function parseAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return next();
    const payload = verifyToken(token);
    if (!payload) return next();
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, picture: true },
      });
      if (user) {
        req.userId = user.id;
        req.user = user;
      }
    } catch (err: any) {
      // Database unreachable (e.g. Supabase paused, network issue) - don't crash the server
      console.error('Auth: could not look up user (database error):', err?.message || err);
    }
    next();
  }

  /** Require logged-in user. 401 if not. */
  function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.userId || !req.user) {
      return res.status(401).json({ error: 'You must be logged in to do that.', code: 'AUTH_REQUIRED' });
    }
    next();
  }

  /** Require accountId in params belongs to req.userId. Use after requireAuth. */
  async function requireAccountOwnership(req: AuthRequest, res: Response, next: NextFunction) {
    const accountId = req.params.accountId;
    if (!accountId || !req.userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: req.userId },
    });
    if (!account) {
      return res.status(403).json({ error: 'You do not have access to this Klaviyo account.', code: 'FORBIDDEN' });
    }
    next();
  }

  return { parseAuth, requireAuth, requireAccountOwnership };
}
