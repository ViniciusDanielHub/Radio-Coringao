// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../users/users.repository';
import type { IRefreshTokenRepository } from './auth.repository';
import type { JwtService } from '../../shared/services/jwt';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';

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

    // Sempre busca pelo e-mail normalizado
    const user = await this.userRepo.findByEmail(email.trim().toLowerCase());

    // Mesmo erro para e-mail não encontrado e senha errada (evita enumeração)
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
      // Remove token expirado
      await this.tokenRepo.deleteByToken(refreshToken).catch(() => { });
      throw new UnauthorizedError(ErrorCode.AUTH_REFRESH_EXPIRED);
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedError(ErrorCode.AUTH_USER_INACTIVE);
    }

    const accessToken = this.jwtService.generateAccessToken({
      id: stored.user.id,
      role: stored.user.role,
    });

    return { accessToken };
  }

  async logout(refreshToken?: string) {
    if (refreshToken && refreshToken.trim() !== '') {
      await this.tokenRepo.deleteByToken(refreshToken).catch(() => {
        // Ignora erro ao deletar token — logout deve sempre suceder
      });
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
    return rest;
  }
}