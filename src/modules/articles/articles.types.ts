// src/modules/articles/articles.types.ts
import type { ArticleStatus, ArticleType } from '../../shared/entities';

// ─── Filtros de listagem ──────────────────────────────────────
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

// ─── Filtros de busca ─────────────────────────────────────────
export interface SearchPublicFilter {
  q?: string;
  category?: string;
  tag?: string;
  type?: ArticleType;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: 'recent' | 'popular';
}

export interface SearchAdminFilter extends SearchPublicFilter {
  status?: ArticleStatus;
  author?: string;
  authorId?: string;
}

// ─── Trending ─────────────────────────────────────────────────
export interface TrendingFilter {
  limit?: number;
  days?: number;
  categorySlug?: string;
}