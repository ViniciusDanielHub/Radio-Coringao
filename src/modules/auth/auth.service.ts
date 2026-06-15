// src/modules/auth/auth.service.ts
import bcrypt from 'bcryptjs';
import type { IUserRepository } from '../users/users.repository';
import type { IRefreshTokenRepository } from './auth.repository';
import type { JwtService } from '../../shared/services/jwt';
import { UnauthorizedError } from '../../shared/errors';

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly tokenRepo: IRefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.isActive) throw new UnauthorizedError('E-mail ou senha incorretos.');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError('E-mail ou senha incorretos.');

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
    if (!refreshToken) throw new UnauthorizedError('Refresh token não fornecido.');

    try {
      this.jwtService.verifyToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido.');
    }

    const stored = await this.tokenRepo.findByToken(refreshToken);
    if (!stored || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new UnauthorizedError('Refresh token inválido ou expirado.');
    }

    const accessToken = this.jwtService.generateAccessToken({
      id: stored.user.id,
      role: stored.user.role,
    });

    return { accessToken };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) await this.tokenRepo.deleteByToken(refreshToken);
    return { message: 'Logout realizado com sucesso.' };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedError('Usuário não encontrado.');
    const { password: _, ...rest } = user;
    return rest;
  }
}
