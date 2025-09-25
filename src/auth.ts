import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export interface TokenPayload {
  userId: number;
  username: string;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'milo-banana-backend',
      audience: 'milo-banana-client'
    });
  }

  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'milo-banana-backend',
      audience: 'milo-banana-client'
    }) as TokenPayload;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const user = AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const password = authHeader && authHeader.split(' ')[1]; // Bearer PASSWORD

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(500).json({ error: 'Admin password not configured' });
    return;
  }

  if (!password || password !== adminPassword) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }

  next();
};

export const authenticateAdminOrUser = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN_OR_PASSWORD

  if (!token) {
    res.status(401).json({ error: 'Access token or admin password required' });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  // Check if it's admin password first
  if (adminPassword && token === adminPassword) {
    // It's admin access
    next();
    return;
  }

  // Try to verify as JWT token
  try {
    const user = AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token or admin credentials' });
  }
};