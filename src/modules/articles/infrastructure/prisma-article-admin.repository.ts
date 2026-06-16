// src/modules/articles/infrastructure/prisma-article-admin.repository.ts
import { prisma } from '../../../shared/database/prisma';
import { createSlug } from '../../../shared/services/slugify';
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListAdminArticlesFilter, SearchAdminFilter } from '../articles.types';

const articleInclude = {
  author:   { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags:     { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images:   { orderBy: { order: 'asc' as const } },
} as const;

export class PrismaArticleAdminRepository implements IArticleAdminRepository {

  async findById(id: string): Promise<Article | null> {
    return prisma.article.findUnique({
      where: { id },
      include: { images: true },
    }) as unknown as Promise<Article | null>;
  }

  async findByIdAdmin(id: string, authorId?: string): Promise<Article | null> {
    return prisma.article.findFirst({
      where: { id, ...(authorId ? { authorId } : {}) },
      include: articleInclude,
    }) as unknown as Promise<Article | null>;
  }

  async listAdmin(
    filter: ListAdminArticlesFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = {};
    if (filter.authorId) where.authorId = filter.authorId;
    if (filter.status)   where.status   = filter.status;
    if (filter.category) where.category = { slug: filter.category };
    if (filter.type)     where.type     = filter.type;
    if (filter.author)   where.authorId = filter.author;
    if (filter.q) {
      where.OR = [
        { title:   { contains: filter.q, mode: 'insensitive' } },
        { excerpt: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author:   { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        skip, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.article.count({ where }),
    ]);

    return { data: data as unknown as Article[], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async searchAdmin(
    filter: SearchAdminFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = {
      ...(filter.authorId && { authorId: filter.authorId }),
      ...(filter.q && {
        OR: [
          { title:   { contains: filter.q, mode: 'insensitive' } },
          { excerpt: { contains: filter.q, mode: 'insensitive' } },
          { content: { contains: filter.q, mode: 'insensitive' } },
        ],
      }),
      ...(filter.category && { category: { slug: filter.category } }),
      ...(filter.tag      && { tags: { some: { tag: { slug: filter.tag } } } }),
      ...(filter.type     && { type: filter.type }),
      ...(filter.status   && { status: filter.status }),
      ...(filter.author   && { author: { name: { contains: filter.author, mode: 'insensitive' } } }),
      ...((filter.dateFrom || filter.dateTo) && {
        publishedAt: {
          ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
          ...(filter.dateTo   && { lte: new Date(filter.dateTo) }),
        },
      }),
    };

    const orderBy = filter.orderBy === 'popular'
      ? { viewCount: 'desc' as const }
      : { publishedAt: 'desc' as const };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where, orderBy, skip, take: limit,
        select: {
          id: true, title: true, slug: true, excerpt: true,
          coverImage: true, type: true, status: true,
          publishedAt: true, scheduledAt: true, viewCount: true,
          category: { select: { name: true, slug: true, color: true } },
          author:   { select: { id: true, name: true } },
          tags:     { select: { tag: { select: { name: true, slug: true } } } },
        },
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
        tags: tagNames?.length ? { create: await this._resolveTagIds(tagNames) } : undefined,
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

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const item = await prisma.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return !!item;
  }

  // ─── Galeria ─────────────────────────────────────────────
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

  // ─── Dashboard / Stats ───────────────────────────────────
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
        select: {
          id: true, title: true, status: true, updatedAt: true,
          author:   { select: { name: true } },
          category: { select: { name: true, slug: true } },
        },
      }),
    ]);
    return { topArticles, recentArticles };
  }

  async aggregateStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [total, published, draft, review, viewsAgg, last30Days] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: 'PUBLISHED' } }),
      prisma.article.count({ where: { status: 'DRAFT' } }),
      prisma.article.count({ where: { status: 'REVIEW' } }),
      prisma.article.aggregate({ _sum: { viewCount: true } }),
      prisma.article.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    return { total, published, draft, review, totalViews: viewsAgg._sum.viewCount || 0, last30Days };
  }

  // ─── Helper privado ──────────────────────────────────────
  private async _resolveTagIds(tagNames: string[]): Promise<{ tagId: string }[]> {
    const creates: { tagId: string }[] = [];
    for (const name of tagNames) {
      const slug = createSlug(name);
      const tag  = await prisma.tag.upsert({
        where:  { slug },
        update: {},
        create: { name: name.trim(), slug },
      });
      creates.push({ tagId: tag.id });
    }
    return creates;
  }
}
