// src/modules/banners/banners.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { Banner } from '../../shared/entities';

export interface IBannerRepository {
  listPublic(): Promise<Banner[]>;
  listAdmin(): Promise<Banner[]>;
  findById(id: string): Promise<Banner | null>;
  create(data: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Banner>;
  update(id: string, data: Partial<Banner>): Promise<Banner>;
  delete(id: string): Promise<void>;
}

export class BannerRepository implements IBannerRepository {
  async listPublic(): Promise<Banner[]> {
    const now = new Date();
    return prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { order: 'asc' },
    }) as Promise<Banner[]>;
  }

  async listAdmin(): Promise<Banner[]> {
    return prisma.banner.findMany({ orderBy: { order: 'asc' } }) as Promise<Banner[]>;
  }

  async findById(id: string): Promise<Banner | null> {
    return prisma.banner.findUnique({ where: { id } }) as Promise<Banner | null>;
  }

  async create(data: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>): Promise<Banner> {
    return prisma.banner.create({ data }) as Promise<Banner>;
  }

  async update(id: string, data: Partial<Banner>): Promise<Banner> {
    return prisma.banner.update({ where: { id }, data }) as Promise<Banner>;
  }

  async delete(id: string): Promise<void> {
    await prisma.banner.delete({ where: { id } });
  }
}
