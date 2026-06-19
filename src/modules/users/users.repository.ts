// src/modules/users/users.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { User, Role, PaginationParams, PaginatedResult } from '../../shared/entities';

export interface ListUsersFilter {
  role?: Role;
  isActive?: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(filter: ListUsersFilter, pagination: PaginationParams): Promise<PaginatedResult<User>>;
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  count(where?: Partial<User>): Promise<number>;
}

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } }) as Promise<User | null>;
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } }) as Promise<User | null>;
  }

  async list(filter: ListUsersFilter, { page, limit }: PaginationParams): Promise<PaginatedResult<User>> {
    const where: any = {};
    if (filter.role) where.role = filter.role;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          bio: true,
          position: true,
          isActive: true,
          // ── Presença ──────────────────────────────────────────
          lastLoginAt: true,
          lastLogoutAt: true,
          lastSeenAt: true,
          // ─────────────────────────────────────────────────────
          createdAt: true,
          updatedAt: true,
          password: false,
          _count: { select: { articles: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: data as unknown as User[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    return prisma.user.create({ data }) as Promise<User>;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({ where: { id }, data }) as Promise<User>;
  }

  async count(): Promise<number> {
    return prisma.user.count({ where: { isActive: true } });
  }
}