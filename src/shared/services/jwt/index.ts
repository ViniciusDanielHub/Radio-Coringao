// src/shared/services/jwt/index.ts
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../../types';

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
    return jwt.sign(payload, this.secret, { expiresIn: this.accessExpiresIn } as jwt.SignOptions);
  }

  generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.refreshExpiresIn } as jwt.SignOptions);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, this.secret) as JwtPayload;
  }

  getRefreshExpiryDate(): Date {
    const days = parseInt(this.refreshExpiresIn) || 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}

export const jwtService = new JwtService();
