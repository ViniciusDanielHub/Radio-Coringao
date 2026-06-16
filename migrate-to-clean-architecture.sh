#!/usr/bin/env bash
# =============================================================
# migrate-to-clean-architecture.sh
#
# Migra o módulo de artigos para Clean Architecture:
#   • Cria interfaces de repositório separadas (public / admin)
#   • Cria implementações Prisma em infrastructure/
#   • Cria 11 use-cases independentes
#   • Reescreve controllers para receber use-cases via DI
#   • Reescreve rotas para usar o composition root (container)
#   • Cria src/shared/container.ts
#   • Remove arquivos antigos (service, repo único, interfaces antigas)
#
# USO:
#   chmod +x migrate-to-clean-architecture.sh
#   ./migrate-to-clean-architecture.sh
#
# O script é idempotente: pode ser re-executado sem problemas.
# =============================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()    { echo -e "${GREEN}✓${NC}  $1"; }
info()   { echo -e "${CYAN}→${NC}  $1"; }
warn()   { echo -e "${YELLOW}⚠${NC}  $1"; }
header() { echo -e "\n${CYAN}━━━  $1  ━━━${NC}"; }

# ──────────────────────────────────────────────────────────────
# 0. Verificações iniciais
# ──────────────────────────────────────────────────────────────
header "Verificações iniciais"

if [ ! -f "package.json" ]; then
  echo -e "${RED}Erro: execute este script na raiz do projeto (onde está package.json).${NC}"
  exit 1
fi

if ! grep -q '"name": "sports-news-api"' package.json 2>/dev/null; then
  warn "package.json não parece ser do projeto sports-news-api. Continuando mesmo assim..."
fi

log "Raiz do projeto encontrada"

# ──────────────────────────────────────────────────────────────
# 1. Criar diretórios
# ──────────────────────────────────────────────────────────────
header "Criando estrutura de diretórios"

mkdir -p src/modules/articles/repositories
mkdir -p src/modules/articles/infrastructure
mkdir -p src/modules/articles/use-cases
mkdir -p src/modules/articles/public
mkdir -p src/modules/articles/admin
mkdir -p src/shared

log "Diretórios criados"

# ──────────────────────────────────────────────────────────────
# 2. Interfaces de repositório
# ──────────────────────────────────────────────────────────────
header "Criando interfaces de repositório"

# ── 2a. Interface pública ──────────────────────────────────────
cat > src/modules/articles/repositories/article-public.repository.interface.ts << 'EOF'
// src/modules/articles/repositories/article-public.repository.interface.ts
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListPublicArticlesFilter, SearchPublicFilter, TrendingFilter } from '../articles.types';

export interface IArticlePublicRepository {
  findBySlugPublic(slug: string): Promise<Article | null>;
  findById(id: string): Promise<Article | null>;
  listPublic(filter: ListPublicArticlesFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  search(filter: SearchPublicFilter, pagination: PaginationParams): Promise<PaginatedResult<Article>>;
  findTrending(filter: TrendingFilter): Promise<Partial<Article>[]>;
  incrementViewCount(id: string): Promise<void>;
  slugExists(slug: string, excludeId?: string): Promise<boolean>;

  // dashboard / stats — usados também pelo DashboardService
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;
}
EOF
log "article-public.repository.interface.ts"

# ── 2b. Interface admin ────────────────────────────────────────
cat > src/modules/articles/repositories/article-admin.repository.interface.ts << 'EOF'
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

  // escrita
  create(data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  update(id: string, data: Partial<Article> & { tagNames?: string[] }): Promise<Article>;
  delete(id: string): Promise<void>;

  // galeria
  findFirstImage(articleId: string): Promise<ArticleImage | null>;
  addImage(data: Omit<ArticleImage, 'id' | 'createdAt'>): Promise<ArticleImage>;
  findImage(imageId: string, articleId: string): Promise<ArticleImage | null>;
  deleteImage(imageId: string): Promise<void>;

  // stats (necessário para DashboardService)
  findForDashboard(): Promise<{ topArticles: Partial<Article>[]; recentArticles: Partial<Article>[] }>;
  aggregateStats(): Promise<{
    total: number; published: number; draft: number;
    review: number; totalViews: number; last30Days: number;
  }>;
}
EOF
log "article-admin.repository.interface.ts"

# ──────────────────────────────────────────────────────────────
# 3. Implementações Prisma (infrastructure)
# ──────────────────────────────────────────────────────────────
header "Criando implementações Prisma"

# ── 3a. Repositório público ────────────────────────────────────
cat > src/modules/articles/infrastructure/prisma-article-public.repository.ts << 'EOF'
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
EOF
log "prisma-article-public.repository.ts"

# ── 3b. Repositório admin ─────────────────────────────────────
cat > src/modules/articles/infrastructure/prisma-article-admin.repository.ts << 'EOF'
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
EOF
log "prisma-article-admin.repository.ts"

# ──────────────────────────────────────────────────────────────
# 4. Use Cases
# ──────────────────────────────────────────────────────────────
header "Criando use-cases"

# ── 4a. list-articles ─────────────────────────────────────────
cat > src/modules/articles/use-cases/list-articles.use-case.ts << 'EOF'
// src/modules/articles/use-cases/list-articles.use-case.ts
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import type { ArticleType } from '../../../shared/entities';

export interface ListArticlesInput {
  page?: number;
  limit?: number;
  category?: string;
  tag?: string;
  type?: ArticleType;
  featured?: string;
  breaking?: string;
  q?: string;
}

export class ListArticlesUseCase {
  constructor(private readonly repo: IArticlePublicRepository) {}

  async execute(input: ListArticlesInput) {
    const page  = Number(input.page)  || 1;
    const limit = Number(input.limit) || 20;

    return this.repo.listPublic(
      {
        category: input.category,
        tag:      input.tag,
        type:     input.type,
        featured: input.featured === 'true',
        breaking: input.breaking === 'true',
        q:        input.q,
      },
      { page, limit },
    );
  }
}
EOF
log "list-articles.use-case.ts"

# ── 4b. get-article-by-slug ───────────────────────────────────
cat > src/modules/articles/use-cases/get-article-by-slug.use-case.ts << 'EOF'
// src/modules/articles/use-cases/get-article-by-slug.use-case.ts
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import { NotFoundError } from '../../../shared/errors';

export class GetArticleBySlugUseCase {
  constructor(private readonly repo: IArticlePublicRepository) {}

  async execute(slug: string) {
    const article = await this.repo.findBySlugPublic(slug);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    // fire-and-forget — não bloqueia a resposta
    this.repo.incrementViewCount(article.id).catch(() => {});

    return article;
  }
}
EOF
log "get-article-by-slug.use-case.ts"

# ── 4c. search-articles ───────────────────────────────────────
cat > src/modules/articles/use-cases/search-articles.use-case.ts << 'EOF'
// src/modules/articles/use-cases/search-articles.use-case.ts
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import type { SearchPublicFilter } from '../articles.types';

export class SearchArticlesUseCase {
  constructor(private readonly repo: IArticlePublicRepository) {}

  async execute(input: SearchPublicFilter & { page?: number; limit?: number }) {
    const page  = Number(input.page)  || 1;
    const limit = Number(input.limit) || 20;
    return this.repo.search(input, { page, limit });
  }
}
EOF
log "search-articles.use-case.ts"

# ── 4d. list-admin-articles ───────────────────────────────────
cat > src/modules/articles/use-cases/list-admin-articles.use-case.ts << 'EOF'
// src/modules/articles/use-cases/list-admin-articles.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { OWN_ARTICLES_ONLY_ROLES, CAN_EDIT_ANY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class ListAdminArticlesUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    filter: {
      page?: number; limit?: number; status?: ArticleStatus;
      category?: string; type?: ArticleType; author?: string; q?: string;
    },
    userId: string,
    userRole: Role,
  ) {
    const page  = Number(filter.page)  || 1;
    const limit = Number(filter.limit) || 20;
    const ownsOnly   = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const canEditAny = CAN_EDIT_ANY_ROLES.includes(userRole);

    return this.repo.listAdmin(
      {
        authorId: ownsOnly ? userId : undefined,
        status:   filter.status,
        category: filter.category,
        type:     filter.type,
        author:   canEditAny ? filter.author : undefined,
        q:        filter.q,
      },
      { page, limit },
    );
  }
}
EOF
log "list-admin-articles.use-case.ts"

# ── 4e. get-admin-article-by-id ───────────────────────────────
cat > src/modules/articles/use-cases/get-admin-article-by-id.use-case.ts << 'EOF'
// src/modules/articles/use-cases/get-admin-article-by-id.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Role } from '../../../shared/entities';
import { NotFoundError } from '../../../shared/errors';
import { OWN_ARTICLES_ONLY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class GetAdminArticleByIdUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string, userId: string, userRole: Role) {
    const ownsOnly = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const article  = await this.repo.findByIdAdmin(id, ownsOnly ? userId : undefined);
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    return article;
  }
}
EOF
log "get-admin-article-by-id.use-case.ts"

# ── 4f. search-admin-articles ─────────────────────────────────
cat > src/modules/articles/use-cases/search-admin-articles.use-case.ts << 'EOF'
// src/modules/articles/use-cases/search-admin-articles.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Role } from '../../../shared/entities';
import type { SearchAdminFilter } from '../articles.types';
import { OWN_ARTICLES_ONLY_ROLES, CAN_EDIT_ANY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class SearchAdminArticlesUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    filter: SearchAdminFilter & { page?: number; limit?: number },
    userId: string,
    userRole: Role,
  ) {
    const page     = Number(filter.page)  || 1;
    const limit    = Number(filter.limit) || 20;
    const ownsOnly   = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const canEditAny = CAN_EDIT_ANY_ROLES.includes(userRole);

    return this.repo.searchAdmin(
      {
        ...filter,
        authorId: ownsOnly   ? userId        : undefined,
        author:   canEditAny ? filter.author : undefined,
      },
      { page, limit },
    );
  }
}
EOF
log "search-admin-articles.use-case.ts"

# ── 4g. create-article ────────────────────────────────────────
cat > src/modules/articles/use-cases/create-article.use-case.ts << 'EOF'
// src/modules/articles/use-cases/create-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { ForbiddenError } from '../../../shared/errors';
import { createUniqueSlug } from '../../../shared/services/slugify';
import {
  hasPermission,
  CAN_PUBLISH_ROLES,
} from '../../../shared/plugins/permissions.plugin';

export interface CreateArticleInput {
  title: string;
  subtitle?: string;
  content: string;
  excerpt?: string;
  categoryId: string;
  type?: ArticleType;
  status?: ArticleStatus;
  isFeatured?: boolean;
  isBreaking?: boolean;
  isPinned?: boolean;
  coverImageAlt?: string;
  coverImageCredit?: string;
  metaTitle?: string;
  metaDescription?: string;
  scheduledAt?: string;
  tags?: string[];
}

export class CreateArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    input: CreateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    if (!hasPermission(userRole, 'articles:create')) {
      throw new ForbiddenError('Seu cargo não permite criar artigos.');
    }

    const canPublish  = CAN_PUBLISH_ROLES.includes(userRole);
    const finalStatus = this.resolveStatus(input.status, userRole);
    const slug        = await createUniqueSlug(
      input.title,
      (s, excl) => this.repo.slugExists(s, excl),
    );

    return this.repo.create({
      title:             input.title,
      subtitle:          input.subtitle,
      slug,
      content:           input.content,
      excerpt:           input.excerpt,
      type:              input.type || 'NEWS',
      status:            finalStatus,
      isFeatured:        canPublish ? Boolean(input.isFeatured) : false,
      isBreaking:        canPublish ? Boolean(input.isBreaking) : false,
      isPinned:          canPublish ? Boolean(input.isPinned)   : false,
      coverImage:        coverImageUrl || null,
      coverImageAlt:     input.coverImageAlt,
      coverImageCredit:  input.coverImageCredit,
      metaTitle:         input.metaTitle,
      metaDescription:   input.metaDescription,
      publishedAt:       finalStatus === 'PUBLISHED' ? new Date() : null,
      scheduledAt:       input.scheduledAt ? new Date(input.scheduledAt) : null,
      authorId:          userId,
      categoryId:        input.categoryId,
      tagNames:          input.tags,
    });
  }

  private resolveStatus(requested: ArticleStatus | undefined, role: Role): ArticleStatus {
    const status = requested || 'DRAFT';
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    if (!hasPermission(role, 'articles:create')) return 'DRAFT';
    return status;
  }
}
EOF
log "create-article.use-case.ts"

# ── 4h. update-article ────────────────────────────────────────
cat > src/modules/articles/use-cases/update-article.use-case.ts << 'EOF'
// src/modules/articles/use-cases/update-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { NotFoundError, ForbiddenError } from '../../../shared/errors';
import { createUniqueSlug } from '../../../shared/services/slugify';
import { deleteImage } from '../../../shared/services/cloudinary';
import {
  hasPermission,
  CAN_PUBLISH_ROLES,
} from '../../../shared/plugins/permissions.plugin';

export interface UpdateArticleInput {
  title?: string;
  subtitle?: string;
  content?: string;
  excerpt?: string;
  categoryId?: string;
  type?: ArticleType;
  status?: ArticleStatus;
  isFeatured?: boolean;
  isBreaking?: boolean;
  isPinned?: boolean;
  coverImageAlt?: string;
  coverImageCredit?: string;
  metaTitle?: string;
  metaDescription?: string;
  scheduledAt?: string;
  tags?: string[];
}

export class UpdateArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    id: string,
    input: UpdateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Artigo não encontrado.');

    const isOwner = (existing as any).authorId === userId;
    const canEdit =
      hasPermission(userRole, 'articles:edit_any') ||
      (hasPermission(userRole, 'articles:edit_own') && isOwner);

    if (!canEdit) throw new ForbiddenError('Você não tem permissão para editar este artigo.');

    const canPublish  = CAN_PUBLISH_ROLES.includes(userRole);
    const updateData: any = {};

    if (input.title) {
      updateData.title = input.title;
      updateData.slug  = await createUniqueSlug(
        input.title,
        (s, excl) => this.repo.slugExists(s, excl),
        id,
      );
    }

    if (input.subtitle     !== undefined) updateData.subtitle     = input.subtitle;
    if (input.content)                    updateData.content      = input.content;
    if (input.excerpt      !== undefined) updateData.excerpt      = input.excerpt;
    if (input.categoryId)                 updateData.categoryId   = input.categoryId;
    if (input.type)                       updateData.type         = input.type;
    if (input.metaTitle    !== undefined) updateData.metaTitle    = input.metaTitle;
    if (input.metaDescription !== undefined) updateData.metaDescription = input.metaDescription;
    if (input.coverImageAlt   !== undefined) updateData.coverImageAlt   = input.coverImageAlt;
    if (input.coverImageCredit !== undefined) updateData.coverImageCredit = input.coverImageCredit;
    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }

    if (input.status) {
      const finalStatus = this.resolveStatus(input.status, userRole);
      updateData.status = finalStatus;
      if (finalStatus === 'PUBLISHED' && !(existing as any).publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (canPublish) {
      if (input.isFeatured !== undefined) updateData.isFeatured = Boolean(input.isFeatured);
      if (input.isBreaking !== undefined) updateData.isBreaking = Boolean(input.isBreaking);
      if (input.isPinned   !== undefined) updateData.isPinned   = Boolean(input.isPinned);
    }

    if (coverImageUrl) {
      if ((existing as any).coverImage) await deleteImage((existing as any).coverImage);
      updateData.coverImage = coverImageUrl;
    }

    if (input.tags !== undefined) updateData.tagNames = input.tags;

    return this.repo.update(id, updateData);
  }

  private resolveStatus(status: ArticleStatus, role: Role): ArticleStatus {
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    return status;
  }
}
EOF
log "update-article.use-case.ts"

# ── 4i. update-article-status ─────────────────────────────────
cat > src/modules/articles/use-cases/update-article-status.use-case.ts << 'EOF'
// src/modules/articles/use-cases/update-article-status.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, Role } from '../../../shared/entities';
import { NotFoundError, AppError, ForbiddenError } from '../../../shared/errors';
import { hasPermission } from '../../../shared/plugins/permissions.plugin';

export class UpdateArticleStatusUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string, status: ArticleStatus, userRole: Role) {
    const validStatuses = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) throw new AppError('Status inválido.', 400);

    if (status === 'PUBLISHED' && !hasPermission(userRole, 'articles:publish')) {
      throw new ForbiddenError('Seu cargo não permite publicar artigos diretamente.');
    }
    if (status === 'ARCHIVED' && !hasPermission(userRole, 'articles:archive')) {
      throw new ForbiddenError('Seu cargo não permite arquivar artigos.');
    }

    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    return this.repo.update(id, {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    });
  }
}
EOF
log "update-article-status.use-case.ts"

# ── 4j. delete-article ────────────────────────────────────────
cat > src/modules/articles/use-cases/delete-article.use-case.ts << 'EOF'
// src/modules/articles/use-cases/delete-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import { NotFoundError } from '../../../shared/errors';
import { deleteImage } from '../../../shared/services/cloudinary';

export class DeleteArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    if ((article as any).coverImage) await deleteImage((article as any).coverImage);
    for (const img of (article as any).images || []) await deleteImage(img.url);

    await this.repo.delete(id);
    return { message: 'Artigo deletado com sucesso.' };
  }
}
EOF
log "delete-article.use-case.ts"

# ── 4k. add-article-image ─────────────────────────────────────
cat > src/modules/articles/use-cases/add-article-image.use-case.ts << 'EOF'
// src/modules/articles/use-cases/add-article-image.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';

export class AddArticleImageUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    articleId: string,
    imageUrl: string,
    body: { alt?: string; caption?: string; credit?: string },
  ) {
    const lastImage = await this.repo.findFirstImage(articleId);
    return this.repo.addImage({
      url:       imageUrl,
      alt:       body.alt,
      caption:   body.caption,
      credit:    body.credit,
      order:     ((lastImage as any)?.order || 0) + 1,
      articleId,
    });
  }
}
EOF
log "add-article-image.use-case.ts"

# ── 4l. delete-article-image ──────────────────────────────────
cat > src/modules/articles/use-cases/delete-article-image.use-case.ts << 'EOF'
// src/modules/articles/use-cases/delete-article-image.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import { NotFoundError } from '../../../shared/errors';
import { deleteImage } from '../../../shared/services/cloudinary';

export class DeleteArticleImageUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(articleId: string, imageId: string) {
    const image = await this.repo.findImage(imageId, articleId);
    if (!image) throw new NotFoundError('Imagem não encontrada.');
    await deleteImage((image as any).url);
    await this.repo.deleteImage(imageId);
    return { message: 'Imagem deletada.' };
  }
}
EOF
log "delete-article-image.use-case.ts"

# ──────────────────────────────────────────────────────────────
# 5. Controllers (recebem use-cases via injeção)
# ──────────────────────────────────────────────────────────────
header "Criando controllers"

# ── 5a. Controller público ────────────────────────────────────
cat > src/modules/articles/public/articles-public.controller.ts << 'EOF'
// src/modules/articles/public/articles-public.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListArticlesUseCase }        from '../use-cases/list-articles.use-case';
import type { GetArticleBySlugUseCase }    from '../use-cases/get-article-by-slug.use-case';
import type { SearchArticlesUseCase }      from '../use-cases/search-articles.use-case';

export class ArticlePublicController {
  constructor(
    private readonly listUseCase:      ListArticlesUseCase,
    private readonly getBySlugUseCase: GetArticleBySlugUseCase,
    private readonly searchUseCase:    SearchArticlesUseCase,
  ) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.listUseCase.execute(request.query as any));
  };

  getBySlug = async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    return reply.send(await this.getBySlugUseCase.execute(slug));
  };

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.searchUseCase.execute(request.query as any));
  };
}
EOF
log "articles-public.controller.ts"

# ── 5b. Controller admin ──────────────────────────────────────
cat > src/modules/articles/admin/articles-admin.controller.ts << 'EOF'
// src/modules/articles/admin/articles-admin.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListAdminArticlesUseCase }    from '../use-cases/list-admin-articles.use-case';
import type { GetAdminArticleByIdUseCase }  from '../use-cases/get-admin-article-by-id.use-case';
import type { SearchAdminArticlesUseCase }  from '../use-cases/search-admin-articles.use-case';
import type { CreateArticleUseCase }        from '../use-cases/create-article.use-case';
import type { UpdateArticleUseCase }        from '../use-cases/update-article.use-case';
import type { UpdateArticleStatusUseCase }  from '../use-cases/update-article-status.use-case';
import type { DeleteArticleUseCase }        from '../use-cases/delete-article.use-case';
import type { AddArticleImageUseCase }      from '../use-cases/add-article-image.use-case';
import type { DeleteArticleImageUseCase }   from '../use-cases/delete-article-image.use-case';

export class ArticleAdminController {
  constructor(
    private readonly listUseCase:          ListAdminArticlesUseCase,
    private readonly getByIdUseCase:       GetAdminArticleByIdUseCase,
    private readonly searchUseCase:        SearchAdminArticlesUseCase,
    private readonly createUseCase:        CreateArticleUseCase,
    private readonly updateUseCase:        UpdateArticleUseCase,
    private readonly updateStatusUseCase:  UpdateArticleStatusUseCase,
    private readonly deleteUseCase:        DeleteArticleUseCase,
    private readonly addImageUseCase:      AddArticleImageUseCase,
    private readonly deleteImageUseCase:   DeleteArticleImageUseCase,
  ) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.listUseCase.execute(request.query as any, request.user.id, request.user.role),
    );
  };

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.searchUseCase.execute(request.query as any, request.user.id, request.user.role),
    );
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.getByIdUseCase.execute(id, request.user.id, request.user.role),
    );
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(201).send(
      await this.createUseCase.execute(
        request.body as any,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.updateUseCase.execute(
        id,
        request.body as any,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return reply.send(
      await this.updateStatusUseCase.execute(id, status, request.user.role),
    );
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.deleteUseCase.execute(id));
  };

  addImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.code(201).send(
      await this.addImageUseCase.execute(id, request.uploadedFile.path, request.body as any),
    );
  };

  deleteImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, imageId } = request.params as { id: string; imageId: string };
    return reply.send(await this.deleteImageUseCase.execute(id, imageId));
  };
}
EOF
log "articles-admin.controller.ts"

# ──────────────────────────────────────────────────────────────
# 6. Rotas (usam container — sem instanciação local)
# ──────────────────────────────────────────────────────────────
header "Criando rotas"

# ── 6a. Rotas públicas ────────────────────────────────────────
cat > src/modules/articles/public/articles-public.routes.ts << 'EOF'
// src/modules/articles/public/articles-public.routes.ts
import type { FastifyInstance } from 'fastify';
import { articlePublicController } from '../../../shared/container';

export async function articlePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles',        articlePublicController.list);
  app.get('/articles/search', articlePublicController.search);
  app.get('/articles/:slug',  articlePublicController.getBySlug);
}
EOF
log "articles-public.routes.ts"

# ── 6b. Rotas admin ───────────────────────────────────────────
cat > src/modules/articles/admin/articles-admin.routes.ts << 'EOF'
// src/modules/articles/admin/articles-admin.routes.ts
import type { FastifyInstance } from 'fastify';
import { articleAdminController } from '../../../shared/container';
import { updateArticleStatusSchema } from '../articles.schema';
import { requirePermission } from '../../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../../shared/plugins/upload.plugin';

const uploadArticle = createUploadHandler('articles');

export async function articleAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles',        articleAdminController.list);
  app.get('/articles/search', articleAdminController.search);
  app.get('/articles/:id',    articleAdminController.getById);

  app.post(
    '/articles',
    { preHandler: [requirePermission('articles:create'), uploadArticle] },
    articleAdminController.create,
  );

  app.patch(
    '/articles/:id',
    { preHandler: [requirePermission('articles:edit_own'), uploadArticle] },
    articleAdminController.update,
  );

  app.patch(
    '/articles/:id/status',
    { preHandler: [requirePermission('articles:submit')], schema: updateArticleStatusSchema },
    articleAdminController.updateStatus,
  );

  app.delete(
    '/articles/:id',
    { preHandler: [requirePermission('articles:delete')] },
    articleAdminController.delete,
  );

  app.post(
    '/articles/:id/images',
    { preHandler: [uploadArticle] },
    articleAdminController.addImage,
  );

  app.delete('/articles/:id/images/:imageId', articleAdminController.deleteImage);
}
EOF
log "articles-admin.routes.ts"

# ──────────────────────────────────────────────────────────────
# 7. Composition Root (container.ts)
# ──────────────────────────────────────────────────────────────
header "Criando composition root"

cat > src/shared/container.ts << 'EOF'
// src/shared/container.ts
//
// COMPOSITION ROOT — único lugar do projeto que faz "new".
// Todas as rotas importam daqui; nunca instanciam diretamente.
//
// Regra: este arquivo pode importar de qualquer camada.
//        Nenhuma outra camada importa deste arquivo.

import { jwtService } from './services/jwt';

// ─── Infraestrutura ──────────────────────────────────────────
import { PrismaArticlePublicRepository }  from '../modules/articles/infrastructure/prisma-article-public.repository';
import { PrismaArticleAdminRepository }   from '../modules/articles/infrastructure/prisma-article-admin.repository';
import { UserRepository }                 from '../modules/users/users.repository';
import { RefreshTokenRepository }         from '../modules/auth/auth.repository';
import { CategoryRepository }             from '../modules/categories/categories.repository';
import { TagRepository }                  from '../modules/tags/tags.repository';
import { BannerRepository }               from '../modules/banners/banners.repository';
import { MenuRepository }                 from '../modules/menu/menu.repository';
import { SiteSettingsRepository }         from '../modules/settings/settings.repository';

// ─── Use Cases — Articles public ─────────────────────────────
import { ListArticlesUseCase }            from '../modules/articles/use-cases/list-articles.use-case';
import { GetArticleBySlugUseCase }        from '../modules/articles/use-cases/get-article-by-slug.use-case';
import { SearchArticlesUseCase }          from '../modules/articles/use-cases/search-articles.use-case';

// ─── Use Cases — Articles admin ──────────────────────────────
import { ListAdminArticlesUseCase }       from '../modules/articles/use-cases/list-admin-articles.use-case';
import { GetAdminArticleByIdUseCase }     from '../modules/articles/use-cases/get-admin-article-by-id.use-case';
import { SearchAdminArticlesUseCase }     from '../modules/articles/use-cases/search-admin-articles.use-case';
import { CreateArticleUseCase }           from '../modules/articles/use-cases/create-article.use-case';
import { UpdateArticleUseCase }           from '../modules/articles/use-cases/update-article.use-case';
import { UpdateArticleStatusUseCase }     from '../modules/articles/use-cases/update-article-status.use-case';
import { DeleteArticleUseCase }           from '../modules/articles/use-cases/delete-article.use-case';
import { AddArticleImageUseCase }         from '../modules/articles/use-cases/add-article-image.use-case';
import { DeleteArticleImageUseCase }      from '../modules/articles/use-cases/delete-article-image.use-case';

// ─── Services (módulos que ainda não quebramos em use-cases) ─
import { AuthService }                    from '../modules/auth/auth.service';
import { UserService }                    from '../modules/users/users.service';
import { CategoryService }                from '../modules/categories/categories.service';
import { TagService }                     from '../modules/tags/tags.service';
import { BannerService }                  from '../modules/banners/banners.service';
import { MenuService }                    from '../modules/menu/menu.service';
import { SettingsService }                from '../modules/settings/settings.service';
import { DashboardService }               from '../modules/dashboard/dashboard.service';

// ─── Controllers ─────────────────────────────────────────────
import { ArticlePublicController }        from '../modules/articles/public/articles-public.controller';
import { ArticleAdminController }         from '../modules/articles/admin/articles-admin.controller';
import { AuthController }                 from '../modules/auth/auth.controller';
import { UserController }                 from '../modules/users/users.controller';
import { CategoryController }             from '../modules/categories/categories.controller';
import { TagController }                  from '../modules/tags/tags.controller';
import { BannerController }               from '../modules/banners/banners.controller';
import { MenuController }                 from '../modules/menu/menu.controller';
import { SettingsController }             from '../modules/settings/settings.controller';
import { DashboardController }            from '../modules/dashboard/dashboard.controller';
import { LiveScoresController }           from '../modules/live-scores/live-scores.controller';
import { LiveScoresService }              from '../modules/live-scores/live-scores.service';

// ═══════════════════════════════════════════════════════════════
// Repositórios (singleton — uma instância por processo)
// ═══════════════════════════════════════════════════════════════
const articlePublicRepo  = new PrismaArticlePublicRepository();
const articleAdminRepo   = new PrismaArticleAdminRepository();
const userRepo           = new UserRepository();
const refreshTokenRepo   = new RefreshTokenRepository();
const categoryRepo       = new CategoryRepository();
const tagRepo            = new TagRepository();
const bannerRepo         = new BannerRepository();
const menuRepo           = new MenuRepository();
const settingsRepo       = new SiteSettingsRepository();

// ═══════════════════════════════════════════════════════════════
// Use Cases — Articles
// ═══════════════════════════════════════════════════════════════
const listArticlesUseCase         = new ListArticlesUseCase(articlePublicRepo);
const getArticleBySlugUseCase     = new GetArticleBySlugUseCase(articlePublicRepo);
const searchArticlesUseCase       = new SearchArticlesUseCase(articlePublicRepo);

const listAdminArticlesUseCase    = new ListAdminArticlesUseCase(articleAdminRepo);
const getAdminArticleByIdUseCase  = new GetAdminArticleByIdUseCase(articleAdminRepo);
const searchAdminArticlesUseCase  = new SearchAdminArticlesUseCase(articleAdminRepo);
const createArticleUseCase        = new CreateArticleUseCase(articleAdminRepo);
const updateArticleUseCase        = new UpdateArticleUseCase(articleAdminRepo);
const updateArticleStatusUseCase  = new UpdateArticleStatusUseCase(articleAdminRepo);
const deleteArticleUseCase        = new DeleteArticleUseCase(articleAdminRepo);
const addArticleImageUseCase      = new AddArticleImageUseCase(articleAdminRepo);
const deleteArticleImageUseCase   = new DeleteArticleImageUseCase(articleAdminRepo);

// ═══════════════════════════════════════════════════════════════
// Services
// ═══════════════════════════════════════════════════════════════
const authService      = new AuthService(userRepo, refreshTokenRepo, jwtService);
const userService      = new UserService(userRepo, refreshTokenRepo);
const categoryService  = new CategoryService(categoryRepo);
const tagService       = new TagService(tagRepo);
const bannerService    = new BannerService(bannerRepo);
const menuService      = new MenuService(menuRepo);
const settingsService  = new SettingsService(settingsRepo);
const dashboardService = new DashboardService(articleAdminRepo, userRepo, categoryRepo);
const liveScoresService = new LiveScoresService();

// ═══════════════════════════════════════════════════════════════
// Controllers
// ═══════════════════════════════════════════════════════════════
export const articlePublicController = new ArticlePublicController(
  listArticlesUseCase,
  getArticleBySlugUseCase,
  searchArticlesUseCase,
);

export const articleAdminController = new ArticleAdminController(
  listAdminArticlesUseCase,
  getAdminArticleByIdUseCase,
  searchAdminArticlesUseCase,
  createArticleUseCase,
  updateArticleUseCase,
  updateArticleStatusUseCase,
  deleteArticleUseCase,
  addArticleImageUseCase,
  deleteArticleImageUseCase,
);

export const authController      = new AuthController(authService);
export const userController      = new UserController(userService);
export const categoryController  = new CategoryController(categoryService);
export const tagController       = new TagController(tagService);
export const bannerController    = new BannerController(bannerService);
export const menuController      = new MenuController(menuService);
export const settingsController  = new SettingsController(settingsService);
export const dashboardController = new DashboardController(dashboardService);
export const liveScoresController = new LiveScoresController(liveScoresService);
EOF
log "src/shared/container.ts"

# ──────────────────────────────────────────────────────────────
# 8. Atualizar dashboard.routes.ts para usar o container
# ──────────────────────────────────────────────────────────────
header "Atualizando rotas do dashboard"

cat > src/modules/dashboard/dashboard.routes.ts << 'EOF'
// src/modules/dashboard/dashboard.routes.ts
import type { FastifyInstance } from 'fastify';
import { dashboardController } from '../../shared/container';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', dashboardController.getStats);
}
EOF
log "dashboard.routes.ts atualizado para usar container"

# ──────────────────────────────────────────────────────────────
# 9. Atualizar auth.routes.ts para usar o container
# ──────────────────────────────────────────────────────────────
header "Atualizando rotas de auth"

cat > src/modules/auth/auth.routes.ts << 'EOF'
// src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { authController } from '../../shared/container';
import { loginSchema } from './auth.schema';
import { authenticate } from '../../shared/plugins/auth.plugin';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login',   { schema: loginSchema }, authController.login);
  app.post('/refresh', authController.refresh);
  app.post('/logout',  authController.logout);
  app.get('/me',       { preHandler: [authenticate] }, authController.getMe);
}
EOF
log "auth.routes.ts atualizado para usar container"

# ──────────────────────────────────────────────────────────────
# 10. Atualizar demais rotas para usar container
# ──────────────────────────────────────────────────────────────
header "Atualizando rotas dos outros módulos"

cat > src/modules/users/users.routes.ts << 'EOF'
// src/modules/users/users.routes.ts
import type { FastifyInstance } from 'fastify';
import { userController } from '../../shared/container';
import { createUserSchema, updateUserSchema, changeOwnPasswordSchema, changeUserPasswordSchema } from './users.schema';
import { authorize } from '../../shared/plugins/auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const uploadAvatar = createUploadHandler('avatars');

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // ─── Perfil próprio (qualquer usuário logado) ──────────────
  app.patch('/profile/password', { schema: changeOwnPasswordSchema }, userController.changeOwnPassword);
  app.patch('/profile/avatar',   { preHandler: [uploadAvatar] },      userController.updateAvatar);

  // ─── Gestão de usuários (apenas SUPER_ADMIN) ───────────────
  app.get('/users',              { preHandler: [authorize('SUPER_ADMIN')] },                               userController.list);
  app.get('/users/:id',          { preHandler: [authorize('SUPER_ADMIN')] },                               userController.getById);
  app.post('/users',             { preHandler: [authorize('SUPER_ADMIN')], schema: createUserSchema },     userController.create);
  app.patch('/users/:id',        { preHandler: [authorize('SUPER_ADMIN')], schema: updateUserSchema },     userController.update);
  app.patch('/users/:id/password', { preHandler: [authorize('SUPER_ADMIN')], schema: changeUserPasswordSchema }, userController.changeUserPassword);
  app.delete('/users/:id',       { preHandler: [authorize('SUPER_ADMIN')] },                               userController.deactivate);
}
EOF
log "users.routes.ts atualizado"

cat > src/modules/categories/categories.routes.ts << 'EOF'
// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { categoryController } from '../../shared/container';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

export async function categoryPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listPublic);
}

export async function categoryAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listAdmin);

  app.post(
    '/categories',
    { preHandler: [requirePermission('categories:manage')], schema: createCategorySchema },
    categoryController.create,
  );

  app.patch(
    '/categories/:id',
    { preHandler: [requirePermission('categories:manage')], schema: updateCategorySchema },
    categoryController.update,
  );

  app.delete(
    '/categories/:id',
    { preHandler: [requirePermission('categories:delete')] },
    categoryController.delete,
  );
}
EOF
log "categories.routes.ts atualizado"

cat > src/modules/tags/tags.routes.ts << 'EOF'
// src/modules/tags/tags.routes.ts
import type { FastifyInstance } from 'fastify';
import { tagController } from '../../shared/container';
import { listTagsSchema } from './tags.schema';
import { authorize } from '../../shared/plugins/auth.plugin';

export async function tagPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tags', { schema: listTagsSchema }, tagController.list);
}

export async function tagAdminRoutes(app: FastifyInstance): Promise<void> {
  app.delete('/tags/:id', { preHandler: [authorize('SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR')] }, tagController.delete);
}
EOF
log "tags.routes.ts atualizado"

cat > src/modules/banners/banners.routes.ts << 'EOF'
// src/modules/banners/banners.routes.ts
import type { FastifyInstance } from 'fastify';
import { bannerController } from '../../shared/container';
import { createBannerSchema, updateBannerSchema } from './banners.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const uploadBanner = createUploadHandler('banners');

export async function bannerPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listPublic);
}

export async function bannerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listAdmin);

  app.post(
    '/banners',
    { preHandler: [requirePermission('banners:manage'), uploadBanner], schema: createBannerSchema },
    bannerController.create,
  );

  app.patch(
    '/banners/:id',
    { preHandler: [requirePermission('banners:manage'), uploadBanner], schema: updateBannerSchema },
    bannerController.update,
  );

  app.delete(
    '/banners/:id',
    { preHandler: [requirePermission('banners:manage')] },
    bannerController.delete,
  );
}
EOF
log "banners.routes.ts atualizado"

cat > src/modules/menu/menu.routes.ts << 'EOF'
// src/modules/menu/menu.routes.ts
import type { FastifyInstance } from 'fastify';
import { menuController } from '../../shared/container';
import { createMenuItemSchema, updateMenuItemSchema } from './menu.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

export async function menuPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getPublic);
}

export async function menuAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getAdmin);

  app.post(
    '/menu',
    { preHandler: [requirePermission('menu:manage')], schema: createMenuItemSchema },
    menuController.create,
  );

  app.patch(
    '/menu/:id',
    { preHandler: [requirePermission('menu:manage')], schema: updateMenuItemSchema },
    menuController.update,
  );

  app.delete(
    '/menu/:id',
    { preHandler: [requirePermission('menu:delete')] },
    menuController.delete,
  );
}
EOF
log "menu.routes.ts atualizado"

cat > src/modules/settings/settings.routes.ts << 'EOF'
// src/modules/settings/settings.routes.ts
import type { FastifyInstance } from 'fastify';
import { settingsController } from '../../shared/container';
import { updateSettingsSchema } from './settings.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const uploadLogo = createUploadHandler('avatars');

export async function settingsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', settingsController.get);
}

export async function settingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.patch(
    '/settings',
    { preHandler: [requirePermission('settings:manage')], schema: updateSettingsSchema },
    settingsController.update,
  );

  app.patch(
    '/settings/logo',
    { preHandler: [requirePermission('settings:manage'), uploadLogo] },
    settingsController.updateLogo,
  );
}
EOF
log "settings.routes.ts atualizado"

# ──────────────────────────────────────────────────────────────
# 11. Atualizar auth.plugin.ts para usar o container
# ──────────────────────────────────────────────────────────────
header "Atualizando auth.plugin.ts"

# O auth.plugin instancia UserRepository diretamente — migramos para o container também
cat > src/shared/plugins/auth.plugin.ts << 'EOF'
// src/shared/plugins/auth.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../services/jwt';
import type { Role } from '../entities';

// Importação lazy para evitar dependência circular com o container
let _userRepo: { findById(id: string): Promise<any> } | null = null;

function getUserRepo() {
  if (!_userRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { UserRepository } = require('../../modules/users/users.repository');
    _userRepo = new UserRepository();
  }
  return _userRepo;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Token de autenticação não fornecido.' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwtService.verifyToken(token);

    const user = await getUserRepo().findById(decoded.id);
    if (!user || !user.isActive) {
      reply.code(401).send({ error: 'Usuário não encontrado ou desativado.' });
      return;
    }

    request.user = {
      id:       user.id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      isActive: user.isActive,
    };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Token expirado. Faça login novamente.' });
    } else {
      reply.code(401).send({ error: 'Token inválido.' });
    }
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user?.role)) {
      reply.code(403).send({ error: 'Acesso negado. Você não tem permissão para esta ação.' });
    }
  };
}
EOF
log "auth.plugin.ts atualizado"

# ──────────────────────────────────────────────────────────────
# 12. Remover arquivos obsoletos
# ──────────────────────────────────────────────────────────────
header "Removendo arquivos obsoletos"

OBSOLETE_FILES=(
  "src/modules/articles/articles.repository.ts"
  "src/modules/articles/articles.repository.interface.ts"
  "src/modules/articles/admin/articles-admin.service.ts"
  "src/modules/articles/admin/articles-admin.repository.interface.ts"
  "src/modules/articles/public/articles-public.service.ts"
)

for f in "${OBSOLETE_FILES[@]}"; do
  if [ -f "$f" ]; then
    rm "$f"
    log "Removido: $f"
  else
    warn "Não encontrado (já removido?): $f"
  fi
done

# ──────────────────────────────────────────────────────────────
# 13. Verificar se articles.types.ts existe (não alterar)
# ──────────────────────────────────────────────────────────────
header "Verificando arquivos mantidos"

KEEP_FILES=(
  "src/modules/articles/articles.schema.ts"
  "src/modules/articles/articles.types.ts"
  "src/shared/entities/index.ts"
  "src/shared/errors/index.ts"
  "src/shared/services/cloudinary/index.ts"
  "src/shared/services/jwt/index.ts"
  "src/shared/services/slugify/index.ts"
  "src/shared/plugins/permissions.plugin.ts"
  "src/shared/plugins/upload.plugin.ts"
  "src/shared/plugins/error-handler.plugin.ts"
  "src/shared/types/index.ts"
  "src/shared/database/prisma.ts"
)

ALL_OK=true
for f in "${KEEP_FILES[@]}"; do
  if [ -f "$f" ]; then
    log "OK: $f"
  else
    warn "AUSENTE: $f  ← verifique se o arquivo existe no seu projeto"
    ALL_OK=false
  fi
done

# ──────────────────────────────────────────────────────────────
# 14. Resumo final
# ──────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Migração concluída!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Arquivos criados:${NC}"
echo "    src/shared/container.ts"
echo "    src/modules/articles/repositories/article-public.repository.interface.ts"
echo "    src/modules/articles/repositories/article-admin.repository.interface.ts"
echo "    src/modules/articles/infrastructure/prisma-article-public.repository.ts"
echo "    src/modules/articles/infrastructure/prisma-article-admin.repository.ts"
echo "    src/modules/articles/use-cases/ (11 use-cases)"
echo "    src/modules/articles/public/articles-public.controller.ts"
echo "    src/modules/articles/public/articles-public.routes.ts"
echo "    src/modules/articles/admin/articles-admin.controller.ts"
echo "    src/modules/articles/admin/articles-admin.routes.ts"
echo ""
echo -e "  ${CYAN}Arquivos atualizados (rotas → container):${NC}"
echo "    src/modules/auth/auth.routes.ts"
echo "    src/modules/users/users.routes.ts"
echo "    src/modules/categories/categories.routes.ts"
echo "    src/modules/tags/tags.routes.ts"
echo "    src/modules/banners/banners.routes.ts"
echo "    src/modules/menu/menu.routes.ts"
echo "    src/modules/settings/settings.routes.ts"
echo "    src/modules/dashboard/dashboard.routes.ts"
echo "    src/shared/plugins/auth.plugin.ts"
echo ""
echo -e "  ${CYAN}Arquivos removidos:${NC}"
echo "    src/modules/articles/articles.repository.ts"
echo "    src/modules/articles/articles.repository.interface.ts"
echo "    src/modules/articles/admin/articles-admin.service.ts"
echo "    src/modules/articles/admin/articles-admin.repository.interface.ts"
echo "    src/modules/articles/public/articles-public.service.ts"
echo ""
echo -e "  ${YELLOW}Próximos passos:${NC}"
echo "    1. npm run build        — verificar erros de TypeScript"
echo "    2. npm run dev          — testar em desenvolvimento"
echo "    3. Revisar src/shared/container.ts se tiver módulos extras"
echo ""

if [ "$ALL_OK" = false ]; then
  echo -e "  ${YELLOW}⚠  Alguns arquivos de suporte não foram encontrados.${NC}"
  echo -e "     Verifique os itens marcados com AUSENTE acima."
  echo ""
fi
