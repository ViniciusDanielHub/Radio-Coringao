// src/modules/articles/admin/articles-admin.repository.interface.ts
import type { IArticleRepository } from '../articles.repository.interface';
import type { Article, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListAdminArticlesFilter, SearchAdminFilter } from '../articles.types';

export interface IArticleAdminRepository extends IArticleRepository {
  findByIdAdmin(id: string, authorId?: string): Promise<Article | null>;
  listAdmin(filter: ListAdminArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  searchAdmin(filter: SearchAdminFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
}