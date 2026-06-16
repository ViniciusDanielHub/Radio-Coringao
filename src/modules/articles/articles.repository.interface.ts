// src/modules/articles/articles.repository.interface.ts
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../shared/entities';
import type {
  ListPublicArticlesFilter,
  ListAdminArticlesFilter,
  SearchPublicFilter,
  SearchAdminFilter,
  TrendingFilter,
} from './articles.types';

export interface IArticleRepository {
  findBySlugPublic(slug: string): Promise<Article | null>;
  findByIdAdmin(id: string, authorId?: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  listPublic(filter: ListPublicArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  listAdmin(filter: ListAdminArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  search(filter: SearchPublicFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  searchAdmin(filter: SearchAdminFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  create(data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  update(id: string, data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  delete(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;
  findTrending(filter: TrendingFilter): Promise<Partial<Article>[]>;
  findFirstImage(articleId: string): Promise<ArticleImage | null>;
  addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage>;
  findImage(imageId: string, articleId: string): Promise<ArticleImage | null>;
  deleteImage(imageId: string): Promise<void>;
}