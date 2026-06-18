// src/modules/articles/infrastructure/prisma-article-admin.repository.ts
//
// CORREÇÃO DESTA VERSÃO — getMostReadArticle:
//
//   ANTES: fazia 2 queries que buscavam essencialmente a mesma coisa
//   (groupBy com _count, e depois findMany com distinct) para then
//   juntar os resultados em memória. Problemas:
//     1. Redundante — os dois dados podem vir de uma única query SQL
//        com COUNT(*) e COUNT(DISTINCT "ipHash").
//     2. Risco de inconsistência: se uma nova ArticleView for inserida
//        entre as duas queries, os números não batem mais entre si.
//     3. Mais round-trips ao banco do que necessário.
//
//   AGORA: uma única query SQL raw, no mesmo estilo que já era usado
//   em getReadsPerMonth — agrupa por articleId, agrega totalReads e
//   uniqueReaders na mesma passada, ordena por uniqueReaders e pega o
//   top 1. O filtro de período (from/to) é montado condicionalmente
//   com Prisma.sql/Prisma.empty (em vez de passar `null` como parâmetro
//   de timestamp, que é ambíguo para o driver decidir o tipo).
import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/database/prisma';
import { createSlug } from '../../../shared/services/slugify';
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListAdminArticlesFilter, SearchAdminFilter } from '../articles.types';

const articleInclude = {
  author: { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images: { orderBy: { order: 'asc' as const } },
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

  // ─── Verifica existência de categoria ────────────────────────
  async categoryExists(categoryId: string): Promise<boolean> {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    return !!cat;
  }

  async listAdmin(
    filter: ListAdminArticlesFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = {};
    if (filter.authorId) where.authorId = filter.authorId;
    if (filter.status) where.status = filter.status;
    if (filter.category) where.category = { slug: filter.category };
    if (filter.type) where.type = filter.type;
    if (filter.author) where.authorId = filter.author;
    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { excerpt: { contains: filter.q, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        skip, take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.article.count({ where }),
    ]);

    return {
      data: data as unknown as Article[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchAdmin(
    filter: SearchAdminFilter,
    { page, limit }: PaginationParams,
  ): Promise<PaginatedResult<Article>> {
    const where: any = {
      ...(filter.authorId && { authorId: filter.authorId }),
      ...(filter.q && {
        OR: [
          { title: { contains: filter.q, mode: 'insensitive' } },
          { excerpt: { contains: filter.q, mode: 'insensitive' } },
          { content: { contains: filter.q, mode: 'insensitive' } },
        ],
      }),
      ...(filter.category && { category: { slug: filter.category } }),
      ...(filter.tag && { tags: { some: { tag: { slug: filter.tag } } } }),
      ...(filter.type && { type: filter.type }),
      ...(filter.status && { status: filter.status }),
      ...(filter.author && { author: { name: { contains: filter.author, mode: 'insensitive' } } }),
      ...((filter.dateFrom || filter.dateTo) && {
        publishedAt: {
          ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
          ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
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
          author: { select: { id: true, name: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
        },
      }),
      prisma.article.count({ where }),
    ]);

    return {
      data: data as unknown as Article[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(data: any): Promise<Article> {
    const { tagNames, ...articleData } = data;
    const result = await prisma.article.create({
      data: {
        ...articleData,
        tags: tagNames?.length
          ? { create: await this._resolveTagIds(tagNames) }
          : undefined,
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
          author: { select: { name: true } },
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

    return {
      total,
      published,
      draft,
      review,
      totalViews: viewsAgg._sum.viewCount || 0,
      last30Days,
    };
  }

  // ════════════════════════════════════════════════════════
  // RELATÓRIOS
  // ════════════════════════════════════════════════════════

  /**
   * Quantidade de artigos por mês, separados por status PUBLISHED e REVIEW.
   * Para PUBLISHED, usa publishedAt (data real de publicação).
   * Para REVIEW, usa createdAt (não têm publishedAt ainda).
   *
   * Retorna os últimos `months` meses (incluindo o mês atual), do mais
   * antigo para o mais recente, mesmo que algum mês tenha zero artigos.
   */
  async getArticlesPerMonth(months = 12): Promise<
    { month: string; published: number; review: number }[]
  > {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [publishedRows, reviewRows] = await Promise.all([
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', "publishedAt") AS month, COUNT(*)::bigint AS count
        FROM "articles"
        WHERE "status" = 'PUBLISHED' AND "publishedAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::bigint AS count
        FROM "articles"
        WHERE "status" = 'REVIEW' AND "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    return this._mergeMonthlySeries(months, publishedRows, reviewRows);
  }

  /**
   * Total de leituras e leitores únicos por mês, baseado em ArticleView.
   *  - reads: total de registros no mês. Como cada registro já representa
   *    no máximo 1 leitura por IP/artigo/dia (garantido pela constraint
   *    única no banco — ver migration), isso é "visitantes-dia", não
   *    "requisições brutas" (essas últimas estão em viewCount).
   *  - uniqueReaders: contagem de ipHash distintos no mês inteiro
   *    (uma pessoa que leu em dias diferentes do mesmo mês conta 1 vez).
   */
  async getReadsPerMonth(months = 12): Promise<
    { month: string; reads: number; uniqueReaders: number }[]
  > {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await prisma.$queryRaw<{ month: Date; reads: bigint; uniqueReaders: bigint }[]>`
      SELECT
        date_trunc('month', "viewedAt") AS month,
        COUNT(*)::bigint AS reads,
        COUNT(DISTINCT "ipHash")::bigint AS "uniqueReaders"
      FROM "article_views"
      WHERE "viewedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    const months_: { month: string; reads: number; uniqueReaders: number }[] = [];
    const cursor = new Date(since);
    for (let i = 0; i < months; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const found = rows.find(r => {
        const d = new Date(r.month);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      });
      months_.push({
        month: key,
        reads: found ? Number(found.reads) : 0,
        uniqueReaders: found ? Number(found.uniqueReaders) : 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months_;
  }

  /**
   * Matéria mais lida, opcionalmente filtrando por período.
   * "Mais lida" é definida por leitores únicos (ipHash distintos) no
   * período — mais robusto que o contador simples, que conta refresh.
   *
   * Implementação: UMA ÚNICA query SQL agregada (substituiu o par
   * groupBy + findMany distinct da versão anterior). O filtro de
   * período é montado condicionalmente com Prisma.sql/Prisma.empty —
   * evita passar `null` como parâmetro de timestamp, que é ambíguo
   * para o driver inferir o tipo (`null::timestamp` exige cast
   * explícito; aqui simplesmente omitimos a cláusula quando não há
   * filtro, em vez de tentar comparar com NULL).
   *
   * Se nenhum período for informado, considera todo o histórico de
   * ArticleView. Se não houver nenhum registro em ArticleView ainda
   * (ex: logo após o deploy desta feature), cai para viewCount como
   * fallback, para o admin não ver "vazio" sem necessidade.
   */
  async getMostReadArticle(period?: { from?: Date; to?: Date }): Promise<{
    article: { id: string; title: string; slug: string } | null;
    totalReads: number;
    uniqueReaders: number;
    source: 'article_views' | 'view_count_fallback';
  }> {
    const dateFilter = Prisma.sql`
      ${period?.from ? Prisma.sql`AND "viewedAt" >= ${period.from}` : Prisma.empty}
      ${period?.to ? Prisma.sql`AND "viewedAt" <= ${period.to}` : Prisma.empty}
    `;

    const rows = await prisma.$queryRaw<{
      articleId: string;
      totalReads: bigint;
      uniqueReaders: bigint;
    }[]>`
      SELECT
        "articleId",
        COUNT(*)::bigint AS "totalReads",
        COUNT(DISTINCT "ipHash")::bigint AS "uniqueReaders"
      FROM "article_views"
      WHERE true ${dateFilter}
      GROUP BY "articleId"
      ORDER BY "uniqueReaders" DESC, "totalReads" DESC
      LIMIT 1
    `;

    const top = rows[0];

    if (top) {
      const article = await prisma.article.findUnique({
        where: { id: top.articleId },
        select: { id: true, title: true, slug: true },
      });

      return {
        article: article ?? null,
        totalReads: Number(top.totalReads),
        uniqueReaders: Number(top.uniqueReaders),
        source: 'article_views',
      };
    }

    // Fallback: ainda não há dados em ArticleView (ex: feature recém-ativada).
    // Usa o contador simples viewCount, que já existia antes.
    const fallback = await prisma.article.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      select: { id: true, title: true, slug: true, viewCount: true },
    });

    return {
      article: fallback ? { id: fallback.id, title: fallback.title, slug: fallback.slug } : null,
      totalReads: fallback?.viewCount ?? 0,
      uniqueReaders: 0, // não temos como saber "únicos" sem ArticleView
      source: 'view_count_fallback',
    };
  }

  // ─── Helper privado: junta as duas séries mensais (published/review) ──
  private _mergeMonthlySeries(
    months: number,
    publishedRows: { month: Date; count: bigint }[],
    reviewRows: { month: Date; count: bigint }[],
  ): { month: string; published: number; review: number }[] {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);

    const result: { month: string; published: number; review: number }[] = [];
    const cursor = new Date(since);

    for (let i = 0; i < months; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;

      const pub = publishedRows.find(r => {
        const d = new Date(r.month);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      });
      const rev = reviewRows.find(r => {
        const d = new Date(r.month);
        return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
      });

      result.push({
        month: key,
        published: pub ? Number(pub.count) : 0,
        review: rev ? Number(rev.count) : 0,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return result;
  }

  // ─── Helper privado ──────────────────────────────────────
  private async _resolveTagIds(tagNames: string[]): Promise<{ tagId: string }[]> {
    const creates: { tagId: string }[] = [];
    for (const name of tagNames) {
      const slug = createSlug(name);
      const tag = await prisma.tag.upsert({
        where: { slug },
        update: {},
        create: { name: name.trim(), slug },
      });
      creates.push({ tagId: tag.id });
    }
    return creates;
  }
}