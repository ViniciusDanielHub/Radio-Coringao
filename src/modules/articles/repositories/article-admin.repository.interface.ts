// src/modules/articles/repositories/article-admin.repository.interface.ts
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListAdminArticlesFilter, SearchAdminFilter } from '../articles.types';

export interface IArticleAdminRepository {
  // leitura
  findById(id: string): Promise<Article | null>;
  findByIdAdmin(id: string, authorId?: string): Promise<Article | null>;
  listAdmin(filter: ListAdminArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  searchAdmin(filter: SearchAdminFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  categoryExists(categoryId: string): Promise<boolean>;

  // escrita
  create(data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  update(id: string, data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  delete(id: string): Promise<void>;

  // galeria
  findFirstImage(articleId: string): Promise<ArticleImage | null>;
  addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage>;
  findImage(imageId: string, articleId: string): Promise<ArticleImage | null>;
  deleteImage(imageId: string): Promise<void>;

  // stats
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;

  // relatórios novos
  getArticlesPerMonth(months?: number): Promise<
    { month: string; published: number; review: number }[]
  >;
  getReadsPerMonth(months?: number): Promise<
    { month: string; reads: number; uniqueReaders: number }[]
  >;
  getMostReadArticle(period?: { from?: Date; to?: Date }): Promise<{
    article: { id: string; title: string; slug: string } | null;
    totalReads: number;
    uniqueReaders: number;
    source: 'article_views' | 'view_count_fallback';
  }>;

  // ── novas features ──────────────────────────────────────
  /** Conta artigos com scheduledAt dentro do mês atual (ainda não publicados) */
  countScheduledThisMonth(): Promise<number>;
  /** Conta artigos com status DRAFT ou REVIEW (pendentes) */
  countPending(): Promise<{ draft: number; review: number; total: number }>;
  /** Conta artigos PUBLISHED com publishedAt no ano atual */
  countPublishedThisYear(): Promise<number>;
}