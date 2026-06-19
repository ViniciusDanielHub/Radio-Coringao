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
//
// ADIÇÕES DESTA VERSÃO — 3 novas métricas de dashboard:
//   - countScheduledThisMonth: artigos com scheduledAt dentro do mês
//     corrente (ainda não publicados — status DRAFT/REVIEW agendados).
//   - countPending: artigos em DRAFT ou REVIEW (pendentes de publicação).
//   - countPublishedThisYear: total de artigos PUBLISHED cujo
//     publishedAt cai no ano corrente.
//
// ADIÇÕES DESTA VERSÃO — relatórios por categoria:
//   - getArticlesByCategory: artigos PUBLISHED agrupados por categoria,
//     dentro de um período arbitrário (mês/6 meses/ano — decidido pelo
//     Service). Mesmo critério de getArticlesPerMonth, agrupado por
//     categoria em vez de por mês.
//   - getMostReadByCategory: a matéria mais lida de CADA categoria no
//     período, por leitores únicos — usa DISTINCT ON para pegar o
//     top-1 de cada categoria em uma única query (ver comentário
//     detalhado na implementação, mais abaixo).
//
// CORREÇÃO DESTA VERSÃO — fuso horário (UTC) em getArticlesPerMonth /
// getReadsPerMonth / _mergeMonthlySeries:
//
//   ANTES: o `since` usado para montar as chaves de mês no array de
//   resposta era calculado com `new Date()` + `setMonth`/`setDate`,
//   que operam no FUSO LOCAL do processo Node. Já a query SQL agrupava
//   com `date_trunc('month', "publishedAt")`, que o Postgres trunca
//   por padrão na timezone DA SESSÃO/CONEXÃO (geralmente UTC, mas
//   depende da configuração do banco/driver). Se o fuso local do
//   processo Node não fosse UTC, um artigo publicado nos primeiros ou
//   últimos dias do mês podia "cair" em um mês diferente no SQL do que
//   no array final montado em JS — exatamente o sintoma observado
//   (artigo com publishedAt em 17/06 aparecendo agrupado em "2026-05").
//
//   AGORA: tudo passa a operar em UTC, ponta a ponta:
//     1. `since` é construído com `Date.UTC(...)` em vez de
//        `setMonth`/`setDate` (que usam o fuso local).
//     2. `date_trunc('month', "coluna", 'UTC')` — terceiro argumento
//        explícito força o truncamento em UTC, independente da
//        timezone da sessão Postgres.
//     3. O cursor que monta as chaves "YYYY-MM" do array de resposta
//        usa `getUTCFullYear()` / `getUTCMonth()` / `setUTCMonth()`,
//        e a comparação com as linhas vindas do banco também usa
//        `getUTCFullYear()` / `getUTCMonth()` em vez das variantes
//        locais. Assim a chave gerada em JS e o mês truncado no SQL
//        sempre se referem ao mesmo "mês UTC".
import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/database/prisma';
import { createSlug } from '../../../shared/services/slugify';
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Article, ArticleImage, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListAdminArticlesFilter, SearchAdminFilter } from '../articles.types';
import type { CategoryArticleCount, CategoryMostRead } from '../category-reports.types';

const articleInclude = {
  author: { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images: { orderBy: { order: 'asc' as const } },
} as const;

// ─── Helper: 1º dia do mês, N meses atrás, em UTC ─────────────
// Substitui o padrão antigo (new Date() + setMonth/setDate, que usa
// o fuso LOCAL do processo) por um cálculo inteiramente em UTC, para
// bater exatamente com o date_trunc(..., 'UTC') usado nas queries.
function utcMonthsAgoStart(monthsAgo: number, base: Date = new Date()): Date {
  return new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth() - monthsAgo,
    1, 0, 0, 0, 0,
  ));
}

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
   *
   * Tudo em UTC (ver nota de correção no topo do arquivo) — `since` é
   * calculado com Date.UTC, e o agrupamento SQL usa
   * date_trunc('month', coluna, 'UTC').
   */
  async getArticlesPerMonth(months = 12): Promise<
    { month: string; published: number; review: number }[]
  > {
    const since = utcMonthsAgoStart(months - 1);

    const [publishedRows, reviewRows] = await Promise.all([
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', "publishedAt", 'UTC') AS month, COUNT(*)::bigint AS count
        FROM "articles"
        WHERE "status" = 'PUBLISHED' AND "publishedAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', "createdAt", 'UTC') AS month, COUNT(*)::bigint AS count
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
   *
   * Tudo em UTC — mesmo motivo de getArticlesPerMonth.
   */
  async getReadsPerMonth(months = 12): Promise<
    { month: string; reads: number; uniqueReaders: number }[]
  > {
    const since = utcMonthsAgoStart(months - 1);

    const rows = await prisma.$queryRaw<{ month: Date; reads: bigint; uniqueReaders: bigint }[]>`
      SELECT
        date_trunc('month', "viewedAt", 'UTC') AS month,
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
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
      const found = rows.find(r => {
        const d = new Date(r.month);
        return d.getUTCFullYear() === cursor.getUTCFullYear() && d.getUTCMonth() === cursor.getUTCMonth();
      });
      months_.push({
        month: key,
        reads: found ? Number(found.reads) : 0,
        uniqueReaders: found ? Number(found.uniqueReaders) : 0,
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
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

  // ════════════════════════════════════════════════════════
  // NOVAS MÉTRICAS DE DASHBOARD
  // ════════════════════════════════════════════════════════

  /**
   * Quantos artigos têm scheduledAt caindo dentro do mês corrente.
   *
   * Critério: scheduledAt entre o início e o fim do mês atual, em UTC
   * (consistente com o restante dos relatórios mensais deste arquivo —
   * ver nota de correção no topo). Não filtra por status: um artigo
   * agendado normalmente está em DRAFT ou REVIEW até o scheduler
   * publicá-lo (ver scheduler.worker.ts), mas a contagem aqui responde
   * literalmente "quantos estão agendados para publicar ainda neste
   * mês" — incluindo casos-limite onde scheduledAt foi setado mas o
   * status ainda não mudou.
   */
  async countScheduledThisMonth(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    return prisma.article.count({
      where: {
        scheduledAt: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
        status: { in: ['DRAFT', 'REVIEW'] },
      },
    });
  }

  /**
   * Artigos pendentes: em DRAFT (rascunho) ou REVIEW (aguardando revisão).
   * Retorna a quebra por status além do total, para o dashboard poder
   * exibir tanto o número agregado quanto o detalhe.
   */
  async countPending(): Promise<{ draft: number; review: number; total: number }> {
    const [draft, review] = await Promise.all([
      prisma.article.count({ where: { status: 'DRAFT' } }),
      prisma.article.count({ where: { status: 'REVIEW' } }),
    ]);
    return { draft, review, total: draft + review };
  }

  /**
   * Total de artigos PUBLISHED cujo publishedAt está no ano corrente.
   * Usa publishedAt (data real de publicação) e não createdAt, para
   * ficar consistente com getArticlesPerMonth. Limites do ano em UTC,
   * pelo mesmo motivo de countScheduledThisMonth.
   */
  async countPublishedThisYear(): Promise<number> {
    const now = new Date();
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const startOfNextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));

    return prisma.article.count({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
    });
  }

  // ════════════════════════════════════════════════════════
  // RELATÓRIOS POR CATEGORIA
  // ════════════════════════════════════════════════════════
  //
  // Os dois métodos abaixo respondem, para um período arbitrário
  // (mês atual / últimos 6 meses / ano atual — decidido pelo Service):
  //
  //   1. getArticlesByCategory  → quantos artigos PUBLISHED cada
  //      categoria teve, usando publishedAt (mesmo critério já usado
  //      em getArticlesPerMonth, agora agrupado por categoria em vez
  //      de por mês).
  //
  //   2. getMostReadByCategory  → a matéria mais lida de CADA
  //      categoria no período, usando leitores únicos (ipHash
  //      distintos em ArticleView), mesmo critério já usado em
  //      getMostReadArticle.
  //
  // Por que DISTINCT ON em vez de GROUP BY + LIMIT por categoria?
  //   GROUP BY articleId (como em getMostReadArticle) só dá o top-1
  //   GERAL. Para "top-1 de CADA categoria" em uma única query, o
  //   Postgres tem DISTINCT ON: agrupa por categoryId e, dentro de
  //   cada grupo, mantém apenas a primeira linha conforme o ORDER BY
  //   — que é exatamente "ranqueia dentro do grupo e pega o nº 1",
  //   sem precisar de window function (ROW_NUMBER) nem de N queries
  //   (uma por categoria).
  //
  // Nota: aqui não há agrupamento por mês (date_trunc), então não há
  // o mesmo risco de fuso horário do getArticlesPerMonth — o filtro
  // de período (from/to) é só um WHERE de intervalo, e quem decide os
  // limites do período é o CategoryReportsService.

  async getArticlesByCategory(
    period: { from: Date; to: Date },
  ): Promise<CategoryArticleCount[]> {
    const rows = await prisma.$queryRaw<{
      categoryId: string;
      categoryName: string;
      categorySlug: string;
      categoryColor: string | null;
      count: bigint;
    }[]>`
      SELECT
        c."id"    AS "categoryId",
        c."name"  AS "categoryName",
        c."slug"  AS "categorySlug",
        c."color" AS "categoryColor",
        COUNT(a."id")::bigint AS count
      FROM "articles" a
      INNER JOIN "categories" c ON c."id" = a."categoryId"
      WHERE a."status" = 'PUBLISHED'
        AND a."publishedAt" >= ${period.from}
        AND a."publishedAt" <= ${period.to}
      GROUP BY c."id", c."name", c."slug", c."color"
      ORDER BY count DESC
    `;

    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      categoryColor: r.categoryColor,
      count: Number(r.count),
    }));
  }

  async getMostReadByCategory(
    period: { from: Date; to: Date },
  ): Promise<CategoryMostRead[]> {
    const rows = await prisma.$queryRaw<{
      categoryId: string;
      categoryName: string;
      categorySlug: string;
      categoryColor: string | null;
      articleId: string;
      articleTitle: string;
      articleSlug: string;
      totalReads: bigint;
      uniqueReaders: bigint;
    }[]>`
      SELECT DISTINCT ON (c."id")
        c."id"    AS "categoryId",
        c."name"  AS "categoryName",
        c."slug"  AS "categorySlug",
        c."color" AS "categoryColor",
        a."id"    AS "articleId",
        a."title" AS "articleTitle",
        a."slug"  AS "articleSlug",
        v."totalReads",
        v."uniqueReaders"
      FROM (
        SELECT
          "articleId",
          COUNT(*)::bigint AS "totalReads",
          COUNT(DISTINCT "ipHash")::bigint AS "uniqueReaders"
        FROM "article_views"
        WHERE "viewedAt" >= ${period.from}
          AND "viewedAt" <= ${period.to}
        GROUP BY "articleId"
      ) v
      INNER JOIN "articles" a ON a."id" = v."articleId"
      INNER JOIN "categories" c ON c."id" = a."categoryId"
      ORDER BY c."id", v."uniqueReaders" DESC, v."totalReads" DESC
    `;

    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      categoryColor: r.categoryColor,
      article: { id: r.articleId, title: r.articleTitle, slug: r.articleSlug },
      totalReads: Number(r.totalReads),
      uniqueReaders: Number(r.uniqueReaders),
    }));
  }

  // ─── Helper privado: junta as duas séries mensais (published/review) ──
  //
  // Em UTC (ver nota de correção no topo): `since` vem de
  // utcMonthsAgoStart, e o cursor usado para gerar as chaves "YYYY-MM"
  // e para comparar com as linhas do banco usa exclusivamente os
  // getters/setters UTC (getUTCFullYear, getUTCMonth, setUTCMonth).
  private _mergeMonthlySeries(
    months: number,
    publishedRows: { month: Date; count: bigint }[],
    reviewRows: { month: Date; count: bigint }[],
  ): { month: string; published: number; review: number }[] {
    const since = utcMonthsAgoStart(months - 1);

    const result: { month: string; published: number; review: number }[] = [];
    const cursor = new Date(since);

    for (let i = 0; i < months; i++) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;

      const pub = publishedRows.find(r => {
        const d = new Date(r.month);
        return d.getUTCFullYear() === cursor.getUTCFullYear() && d.getUTCMonth() === cursor.getUTCMonth();
      });
      const rev = reviewRows.find(r => {
        const d = new Date(r.month);
        return d.getUTCFullYear() === cursor.getUTCFullYear() && d.getUTCMonth() === cursor.getUTCMonth();
      });

      result.push({
        month: key,
        published: pub ? Number(pub.count) : 0,
        review: rev ? Number(rev.count) : 0,
      });

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
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