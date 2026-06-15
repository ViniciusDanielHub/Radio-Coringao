// src/modules/categories/categories.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { Category } from '../../shared/entities';

export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  listPublic(): Promise<(Category & { _count: { articles: number } })[]>;
  listAdmin(): Promise<(Category & { _count: { articles: number } })[]>;
  create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category>;
  update(id: string, data: Partial<Category>): Promise<Category>;
  delete(id: string): Promise<void>;
  countArticles(categoryId: string): Promise<number>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
}

export class CategoryRepository implements ICategoryRepository {
  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } }) as Promise<Category | null>;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { slug } }) as Promise<Category | null>;
  }

  async listPublic(): Promise<(Category & { _count: { articles: number } })[]> {
    const results = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { _count: { select: { articles: { where: { status: 'PUBLISHED' } } } } },
    });
    return results as any;
  }

  async listAdmin(): Promise<(Category & { _count: { articles: number } })[]> {
    const results = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { articles: true } } },
    });
    return results as any;
  }

  async create(data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    return prisma.category.create({ data }) as Promise<Category>;
  }

  async update(id: string, data: Partial<Category>): Promise<Category> {
    return prisma.category.update({ where: { id }, data }) as Promise<Category>;
  }

  async delete(id: string): Promise<void> {
    await prisma.category.delete({ where: { id } });
  }

  async countArticles(categoryId: string): Promise<number> {
    return prisma.article.count({ where: { categoryId } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const item = await prisma.category.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return !!item;
  }
}
