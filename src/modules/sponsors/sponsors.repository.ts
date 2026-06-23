import { prisma } from '../../shared/database/prisma';
import type { Sponsor } from '../../shared/entities';

export interface ISponsorRepository {
  listPublic(): Promise<Sponsor[]>;
  listAdmin(): Promise<Sponsor[]>;
  findById(id: string): Promise<Sponsor | null>;
  findByName(name: string): Promise<Sponsor | null>;
  create(data: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor>;
  update(id: string, data: Partial<Sponsor>): Promise<Sponsor>;
  delete(id: string): Promise<void>;
}

export class SponsorRepository implements ISponsorRepository {
  async listPublic(): Promise<Sponsor[]> {
    return prisma.sponsor.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    }) as Promise<Sponsor[]>;
  }

  async listAdmin(): Promise<Sponsor[]> {
    return prisma.sponsor.findMany({ orderBy: { order: 'asc' } }) as Promise<Sponsor[]>;
  }

  async findById(id: string): Promise<Sponsor | null> {
    return prisma.sponsor.findUnique({ where: { id } }) as Promise<Sponsor | null>;
  }

  async findByName(name: string): Promise<Sponsor | null> {
    return prisma.sponsor.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    }) as Promise<Sponsor | null>;
  }

  async create(data: Omit<Sponsor, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sponsor> {
    return prisma.sponsor.create({ data }) as Promise<Sponsor>;
  }

  async update(id: string, data: Partial<Sponsor>): Promise<Sponsor> {
    return prisma.sponsor.update({ where: { id }, data }) as Promise<Sponsor>;
  }

  async delete(id: string): Promise<void> {
    await prisma.sponsor.delete({ where: { id } });
  }
}