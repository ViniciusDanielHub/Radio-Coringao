// src/modules/articles/infrastructure/prisma-article-public.repository.ts
import { prisma } from '../../../shared/database/prisma';
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import type { Article, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListPublicArticlesFilter, SearchPublicFilter, TrendingFilter } from '../articles.types';

const articleInclude = {
  author:   { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags:     { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images:   { orderBy: { order: 'asc' as const } },
} as const;

export class PrismaArticlePublicRepository implements IArticlePublicRepository {

  async findBySlugPublic(slug: string): Promise<Article | null> {
    return prisma.article.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: articleInclude,
    }) as unknown as Promise<Article | null>;
  }

  async findById(id: string): Promise<Article | null> {
    return prisma.article.findUnique({
      where: { id },
      include: { images: true },
    }) as unknown as Promise<Article | null>;
  }

  async listPublic(
    filter: ListPublicArticlesFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = { status: 'PUBLISHED' };
    if (filter.category) where.category  = { slug: filter.category };
    if (filter.type)     where.type      = filter.type;
    if (filter.featured) where.isFeatured = true;
    if (filter.breaking) where.isBreaking = true;
    if (filter.tag)      where.tags       = { some: { tag: { slug: filter.tag } } };
    if (filter.q) {
      where.OR = [
        { title:   { contains: filter.q, mode: 'insensitive' } },
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

  async search(
    filter: SearchPublicFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = {
      status: 'PUBLISHED',
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
          coverImage: true, type: true, publishedAt: true, viewCount: true,
          category: { select: { name: true, slug: true, color: true } },
          author:   { select: { name: true } },
          tags:     { select: { tag: { select: { name: true, slug: true } } } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    return { data: data as unknown as Article[], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findTrending(filter: TrendingFilter): Promise<Partial<Article>[]> {
    const since = new Date();
    since.setDate(since.getDate() - (filter.days ?? 7));

    return prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: { gte: since },
        ...(filter.categorySlug && { category: { slug: filter.categorySlug } }),
      },
      orderBy: { viewCount: 'desc' },
      take: filter.limit ?? 10,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        coverImage: true, viewCount: true, publishedAt: true,
        category: { select: { name: true, slug: true, color: true } },
        author:   { select: { name: true, avatar: true } },
        tags:     { select: { tag: { select: { name: true, slug: true } } } },
      },
    }) as unknown as Promise<Partial<Article>[]>;
  }

  async incrementViewCount(id: string): Promise<void> {
    await prisma.article.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const item = await prisma.article.findFirst({
      where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return !!item;
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
}
