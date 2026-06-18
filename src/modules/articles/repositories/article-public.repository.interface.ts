// src/modules/articles/repositories/article-public.repository.interface.ts
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListPublicArticlesFilter, SearchPublicFilter, TrendingFilter } from '../articles.types';

export interface IArticlePublicRepository {
  findBySlugPublic(slug: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  listPublic(filter: ListPublicArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  search(filter: SearchPublicFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  findTrending(filter: TrendingFilter): Promise<Partial<Article>[]>;

  // visitorHash e userAgent são opcionais para manter compatibilidade
  // com qualquer chamador antigo que ainda passe só o id.
  incrementViewCount(id: string, visitorHash?: string, userAgent?: string): Promise<void>;

  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  // dashboard / stats — usados também pelo DashboardService
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;
}