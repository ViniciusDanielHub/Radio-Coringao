// src/shared/services/jwt/index.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { JwtPayload } from '../../types';

// Extende o payload para incluir jti (JWT ID) e exp (expiry)
// usados pela blacklist de tokens
export interface FullJwtPayload extends JwtPayload {
  jti: string;
  iat: number;
  exp: number;
}

export class JwtService {
  private readonly secret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.secret = process.env.JWT_SECRET!;
    this.accessExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(
      { ...payload, jti: uuidv4() },  // ← jti único por token
      this.secret,
      { expiresIn: this.accessExpiresIn } as jwt.SignOptions,
    );
  }

  generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(
      { ...payload, jti: uuidv4() },
      this.secret,
      { expiresIn: this.refreshExpiresIn } as jwt.SignOptions,
    );
  }

  verifyToken(token: string): FullJwtPayload {
    return jwt.verify(token, this.secret) as FullJwtPayload;
  }

  getRefreshExpiryDate(): Date {
    const days = parseInt(this.refreshExpiresIn) || 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}

export const jwtService = new JwtService();