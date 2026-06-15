// src/modules/auth/auth.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { RefreshToken, User } from '../../shared/entities';

export interface IRefreshTokenRepository {
  create(data: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken>;
  findByToken(token: string): Promise<(RefreshToken & { user: Pick<User, 'id' | 'role' | 'isActive'> }) | null>;
  deleteByToken(token: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export class RefreshTokenRepository implements IRefreshTokenRepository {
  async create(data: Omit<RefreshToken, 'id' | 'createdAt'>): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data }) as Promise<RefreshToken>;
  }

  async findByToken(token: string): Promise<(RefreshToken & { user: Pick<User, 'id' | 'role' | 'isActive'> }) | null> {
    const result = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, role: true, isActive: true } } },
    });
    return result as any;
  }

  async deleteByToken(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
