// src/modules/articles/articles.repository.interface.ts
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../shared/entities';
import type { ListPublicArticlesFilter, SearchPublicFilter, TrendingFilter } from './articles.types';

export interface IArticleRepository {
  // ─── Leitura pública ────────────────────────────────────────
  findBySlugPublic(slug: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  listPublic(filter: ListPublicArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  search(filter: SearchPublicFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  findTrending(filter: TrendingFilter): Promise<Partial<Article>[]>;

  // ─── Escrita ────────────────────────────────────────────────
  create(data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  update(id: string, data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  delete(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  // ─── Dashboard / stats ──────────────────────────────────────
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;

  // ─── Galeria ────────────────────────────────────────────────
  findFirstImage(articleId: string): Promise<ArticleImage | null>;
  addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage>;
  findImage(imageId: string, articleId: string): Promise<ArticleImage | null>;
  deleteImage(imageId: string): Promise<void>;
}