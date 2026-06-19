// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../users/users.repository';
import type { IRefreshTokenRepository } from './auth.repository';
import type { JwtService } from '../../shared/services/jwt';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { blacklistToken } from '../../shared/services/token-blacklist';
import { presenceService, PresenceService } from '../presence/presence.service';


export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IRefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) { }

  async login(email: string, password: string) {
    if (!email || email.trim() === '') {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'email' });
    }
    if (!password) {
      throw new ValidationError(ErrorCode.VALIDATION_REQUIRED_FIELD, { field: 'password' });
    }

    const user = await this.userRepo.findByEmail(email.trim().toLowerCase());

    if (!user) {
      throw new UnauthorizedError(ErrorCode.AUTH_CREDENTIALS_INVALID);
    }

    if (!user.isActive) {
      throw new UnauthorizedError(ErrorCode.AUTH_USER_INACTIVE);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedError(ErrorCode.AUTH_CREDENTIALS_INVALID);
    }

    const payload = { id: user.id, role: user.role };
    const accessToken = this.jwtService.generateAccessToken(payload);
    const refreshToken = this.jwtService.generateRefreshToken(payload);

    await this.tokenRepo.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: this.jwtService.getRefreshExpiryDate(),
    });

    // ── Registra presença: lastLoginAt + lastSeenAt ──
    // fire-and-forget — não bloqueia a resposta de login se o banco estiver lento
    presenceService.onLogin(user.id).catch((err) => console.error('PRESENCE ERROR:', err));

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken || refreshToken.trim() === '') {
      throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_MISSING);
    }

    try {
      this.jwtService.verifyToken(refreshToken);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_EXPIRED);
      }
      throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_INVALID);
    }

    const stored = await this.tokenRepo.findByToken(refreshToken);

    if (!stored) {
      throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_INVALID);
    }
    if (stored.expiresAt < new Date()) {
      await this.tokenRepo.deleteByToken(refreshToken).catch(() => { });
      throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_EXPIRED);
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedError(ErrorCode.AUTH_USER_INACTIVE);
    }

    await this.tokenRepo.deleteByToken(refreshToken);

    const newPayload = { id: stored.user.id, role: stored.user.role };
    const newAccessToken = this.jwtService.generateAccessToken(newPayload);
    const newRefreshToken = this.jwtService.generateRefreshToken(newPayload);

    await this.tokenRepo.create({
      token: newRefreshToken,
      userId: stored.user.id,
      expiresAt: this.jwtService.getRefreshExpiryDate(),
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // userId é o 4º parâmetro novo — preenchido pelo AuthController via request.user.id
  async logout(
    refreshToken?: string,
    accessTokenJti?: string,
    accessTokenExp?: number,
    userId?: string,
  ) {
    // ── Revoga o refresh token ──
    if (refreshToken && refreshToken.trim() !== '') {
      await this.tokenRepo.deleteByToken(refreshToken).catch(() => { });
    }

    // ── Blacklista o access token para invalidação imediata ──
    if (accessTokenJti && accessTokenExp) {
      await blacklistToken(accessTokenJti, accessTokenExp * 1000).catch(() => { });
    }

    // ── Registra saída: lastLogoutAt ──
    if (userId) {
      presenceService.onLogout(userId).catch(() => { });
    }

    return { message: 'Logout realizado com sucesso.' };
  }

  async getMe(userId: string) {
    if (!userId) {
      throw new UnauthorizedError(ErrorCode.AUTH_USER_NOT_FOUND);
    }
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedError(ErrorCode.AUTH_USER_NOT_FOUND);
    if (!user.isActive) throw new UnauthorizedError(ErrorCode.AUTH_USER_INACTIVE);

    const { password: _, ...rest } = user;
    return PresenceService.withPresence(rest);
  }
}