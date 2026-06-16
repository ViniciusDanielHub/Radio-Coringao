// src/modules/tags/tags.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { Tag } from '../../shared/entities';

export interface ITagRepository {
  findById(id: string): Promise<Tag | null>;
  findBySlug(slug: string): Promise<Tag | null>;
  list(search?: string): Promise<(Tag & { _count: { articles: number } })[]>;
  upsert(name: string, slug: string): Promise<Tag>;
  countArticles(id: string): Promise<number>;
  delete(id: string): Promise<void>;
}

export class TagRepository implements ITagRepository {
  async findById(id: string): Promise<Tag | null> {
    return prisma.tag.findUnique({ where: { id } }) as Promise<Tag | null>;
  }

  async findBySlug(slug: string): Promise<Tag | null> {
    return prisma.tag.findUnique({ where: { slug } }) as Promise<Tag | null>;
  }

  async list(search?: string): Promise<(Tag & { _count: { articles: number } })[]> {
    const results = await prisma.tag.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      include: { _count: { select: { articles: true } } },
      orderBy: { name: 'asc' },
      take: 50,
    });
    return results as any;
  }

  async upsert(name: string, slug: string): Promise<Tag> {
    return prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name: name.trim(), slug },
    }) as Promise<Tag>;
  }

  async countArticles(id: string): Promise<number> {
    return prisma.articleTag.count({ where: { tagId: id } });
  }

  async delete(id: string): Promise<void> {
    await prisma.tag.delete({ where: { id } });
  }
}