// src/shared/entities/index.ts

export type Role =
  | 'SUPER_ADMIN'
  | 'EDITOR_CHEFE'
  | 'EDITOR'
  | 'JORNALISTA'
  | 'COLUNISTA'
  | 'SOCIAL_MEDIA'
  | 'MODERADOR'
  | 'SEO_MANAGER';

export const ROLES: Role[] = [
  'SUPER_ADMIN',
  'EDITOR_CHEFE',
  'EDITOR',
  'JORNALISTA',
  'COLUNISTA',
  'SOCIAL_MEDIA',
  'MODERADOR',
  'SEO_MANAGER',
];

export type ArticleStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type ArticleType = 'NEWS' | 'ANALYSIS' | 'INTERVIEW' | 'LIVE' | 'GALLERY';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  avatar?: string | null;
  bio?: string | null;
  position?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  lastLogoutAt?: Date | null;
  lastSeenAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface Article {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  content: string;
  excerpt?: string | null;
  status: ArticleStatus;
  type: ArticleType;
  isFeatured: boolean;
  isBreaking: boolean;
  isPinned: boolean;
  coverImage?: string | null;
  coverImageAlt?: string | null;
  coverImageCredit?: string | null;
  authorId: string;
  categoryId: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  viewCount: number;
  publishedAt?: Date | null;
  scheduledAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleImage {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
  order: number;
  articleId: string;
  createdAt: Date;
}

export interface ArticleTag {
  articleId: string;
  tagId: string;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  target: string;
  order: number;
  parentId?: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  isActive: boolean;
  order: number;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SiteSettings {
  id: string;
  siteName: string;
  siteDescription?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialYoutube?: string | null;
  googleAnalytics?: string | null;
  footerText?: string | null;
  updatedAt: Date;
}

// ─── Pagination ───────────────────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}