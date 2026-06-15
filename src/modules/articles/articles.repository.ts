// src/modules/articles/articles.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { Article, ArticleImage, ArticleStatus, ArticleType, PaginationParams, PaginatedResult } from '../../shared/entities';
import { createSlug } from '../../shared/services/slugify';

// ─── Contracts ──────────────────────────────────────────────
export interface ListPublicArticlesFilter {
  category?: string;
  tag?: string;
  type?: ArticleType;
  featured?: boolean;
  breaking?: boolean;
  q?: string;
}

export interface ListAdminArticlesFilter {
  authorId?: string;
  status?: ArticleStatus;
  category?: string;
  type?: ArticleType;
  author?: string;
  q?: string;
}

export interface IArticleRepository {
  findBySlugPublic(slug: string): Promise<Article | null>;
  findByIdAdmin(id: string, authorId?: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  listPublic(filter: ListPublicArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  listAdmin(filter: ListAdminArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  create(data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  update(id: string, data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  delete(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    review: number;
    totalViews: number;
    last30Days: number;
  }>;
  findFirstImage(articleId: string): Promise<ArticleImage | null>;
  addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage>;
  findImage(imageId: string, articleId: string): Promise<ArticleImage | null>;
  deleteImage(imageId: string): Promise<void>;
}

// ─── Implementation ─────────────────────────────────────────
const articleInclude = {
  author: { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images: { orderBy: { order: 'asc' } },
} as const;

export class ArticleRepository implements IArticleRepository {
  async findBySlugPublic(slug: string): Promise<Article | null> {
    return prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: articleInclude,
    }) as unknown as Promise<Article | null>;
  }

  async findByIdAdmin(id: string, authorId?: string): Promise<Article | null> {
    return prisma.article.findFirst({
      where: { id, ...(authorId ? { authorId } : {}) },
      include: articleInclude,
    }) as unknown as Promise<Article | null>;
  }

  async findById(id: string): Promise<Article | null> {
    return prisma.article.findUnique({
      where: { id },
      include: { images: true },
    }) as unknown as Promise<Article | null>;
  }

  async listPublic(filter: ListPublicArticlesFilter, { page, limit }: PaginationParams): Promise<PaginatedResult<Article>> {
    const where: any = { status: 'PUBLISHED' };
    if (filter.category) where.category = { slug: filter.category };
    if (filter.type) where.type = filter.type;
    if (filter.featured) where.isFeatured = true;
    if (filter.breaking) where.isBreaking = true;
    if (filter.tag) where.tags = { some: { tag: { slug: filter.tag } } };
    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { excerpt: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where, include: articleInclude, skip, take: limit,
        orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      }),
      prisma.article.count({ where }),
    ]);

    return { data: data as unknown as Article[], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listAdmin(filter: ListAdminArticlesFilter, { page, limit }: PaginationParams): Promise<PaginatedResult<Article>> {
    const where: any = {};
    if (filter.authorId) where.authorId = filter.authorId;
    if (filter.status) where.status = filter.status;
    if (filter.category) where.category = { slug: filter.category };
    if (filter.type) where.type = filter.type;
    if (filter.author) where.authorId = filter.author;
    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { excerpt: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        skip, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.article.count({ where }),
    ]);

    return { data: data as unknown as Article[], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: any): Promise<Article> {
    const { tagNames, ...articleData } = data;

    const result = await prisma.article.create({
      data: {
        ...articleData,
        tags: tagNames?.length
          ? { create: await this._resolveTagIds(tagNames) }
          : undefined,
      },
      include: articleInclude,
    });

    return result as unknown as Article;
  }

  async update(id: string, data: any): Promise<Article> {
    const { tagNames, ...articleData } = data;

    if (tagNames !== undefined) {
      await prisma.articleTag.deleteMany({ where: { articleId: id } });
    }

    const result = await prisma.article.update({
      where: { id },
      data: {
        ...articleData,
        ...(tagNames?.length ? { tags: { create: await this._resolveTagIds(tagNames) } } : {}),
      },
      include: articleInclude,
    });

    return result as unknown as Article;
  }

  async delete(id: string): Promise<void> {
    await prisma.article.delete({ where: { id } });
  }

  async incrementViewCount(id: string): Promise<void> {
    await prisma.article.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  async findForDashboard() {
    const [topArticles, recentArticles] = await Promise.all([
      prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, viewCount: true, publishedAt: true },
      }),
      prisma.article.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          author: { select: { name: true } },
          category: { select: { name: true, slug: true } },
        },
        select: { id: true, title: true, status: true, updatedAt: true, author: true, category: true },
      }),
    ]);
    return { topArticles, recentArticles };
  }

  async aggregateStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [total, published, draft, review, viewsAgg, last30Days] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
      prisma.article.count({ where: { status: 'DRAFT' } }),
      prisma.article.count({ where: { status: 'REVIEW' } }),
      prisma.article.aggregate({ _sum: { viewCount: true } }),
      prisma.article.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    return {
      total, published, draft, review,
      totalViews: viewsAgg._sum.viewCount || 0,
      last30Days,
    };
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const item = await prisma.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return !!item;
  }

  async findFirstImage(articleId: string): Promise<ArticleImage | null> {
    return prisma.articleImage.findFirst({
      where: { articleId },
      orderBy: { order: 'desc' },
    }) as Promise<ArticleImage | null>;
  }

  async addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage> {
    return prisma.articleImage.create({ data }) as Promise<ArticleImage>;
  }

  async findImage(imageId: string, articleId: string): Promise<ArticleImage | null> {
    return prisma.articleImage.findFirst({
      where: { id: imageId, articleId },
    }) as Promise<ArticleImage | null>;
  }

  async deleteImage(imageId: string): Promise<void> {
    await prisma.articleImage.delete({ where: { id: imageId } });
  }

  private async _resolveTagIds(tagNames: string[]): Promise<{ tagId: string }[]> {
    const creates: { tagId: string }[] = [];
    for (const name of tagNames) {
      const slug = createSlug(name);
      const tag = await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name: name.trim(), slug },
      });
      creates.push({ tagId: tag.id });
    }
    return creates;
  }
}
