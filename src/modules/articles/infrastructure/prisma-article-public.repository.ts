// src/modules/articles/infrastructure/prisma-article-public.repository.ts
//
// CORREÇÃO DESTA VERSÃO — incrementViewCount:
//
//   ANTES (race condition):
//     1. findFirst({ articleId, ipHash, viewedAt: { gte: 24h atrás } })
//     2. se achou, retorna
//     3. se não achou, create(...)
//
//     Problema: entre o passo 1 e o 3 não há nenhuma garantia de
//     exclusão mútua. Dois requests do mesmo IP quase simultâneos
//     (comum com double-render do React em dev, prefetch de link,
//     ou bots disparando requests em paralelo) podem AMBOS passar
//     pelo findFirst antes que o primeiro create termine — e os
//     dois inserem um registro para a "mesma leitura".
//
//   AGORA (atômico):
//     1. create(...) direto, sem checagem prévia
//     2. se o banco rejeitar por violar a constraint única
//        (articleId, ipHash, viewBucket) → erro P2002 → ignoramos,
//        pois já existe um registro dessa leitura.
//
//     A unicidade é garantida pelo PRÓPRIO BANCO (constraint), não
//     por uma checagem da aplicação. Isso é atômico por construção:
//     não existe janela de tempo entre "checar" e "agir".
//
//   Mudança de semântica: a janela de dedupe deixa de ser "24h
//   móveis desde a última leitura" e passa a ser "1 leitura por
//   IP/artigo por dia corrente (UTC)" — mais simples, previsível,
//   e compatível com uma constraint única real (uma janela móvel
//   não pode ser expressa como unique constraint em SQL puro).
import { prisma } from '../../../shared/database/prisma';
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import type { Article, PaginationParams, PaginatedResult } from '../../../shared/entities';
import type { ListPublicArticlesFilter, SearchPublicFilter, TrendingFilter } from '../articles.types';

const articleInclude = {
  author: { select: { id: true, name: true, avatar: true, role: true } },
  category: { select: { id: true, name: true, slug: true, color: true } },
  tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
  images: { orderBy: { order: 'asc' as const } },
} as const;

// ─── Detecção básica de bots / crawlers ────────────────────────
// Não bloqueia a leitura (o conteúdo ainda é servido normalmente),
// apenas evita que previews de redes sociais e crawlers de SEO
// infestem as estatísticas como se fossem leitores reais.
const BOT_USER_AGENT_PATTERNS = [
  /bot/i, /spider/i, /crawl/i, /slurp/i,
  /facebookexternalhit/i, /whatsapp/i, /telegrambot/i,
  /twitterbot/i, /linkedinbot/i, /discordbot/i, /slackbot/i,
  /googlebot/i, /bingbot/i, /yandexbot/i, /duckduckbot/i,
  /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /pingdom/i,
  /uptimerobot/i, /headlesschrome/i, /python-requests/i, /curl\//i, /wget\//i,
];

function isLikelyBot(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENT_PATTERNS.some((re) => re.test(userAgent));
}

// ─── Trunca a data para o dia em UTC (00:00:00.000Z) ───────────
// Usado como viewBucket — a granularidade que a constraint única
// (articleId, ipHash, viewBucket) usa para dedupe atômico.
function utcDayBucket(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

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
    if (filter.category) where.category = { slug: filter.category };
    if (filter.type) where.type = filter.type;
    if (filter.featured) where.isFeatured = true;
    if (filter.breaking) where.isBreaking = true;
    if (filter.tag) where.tags = { some: { tag: { slug: filter.tag } } };
    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
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
    const where: any = { status: 'PUBLISHED' };

    if (filter.q) {
      where.OR = [
        { title: { contains: filter.q, mode: 'insensitive' } },
        { excerpt: { contains: filter.q, mode: 'insensitive' } },
        { content: { contains: filter.q, mode: 'insensitive' } },
      ];
    }
    if (filter.category) where.category = { slug: filter.category };
    if (filter.tag) where.tags = { some: { tag: { slug: filter.tag } } };
    if (filter.type) where.type = filter.type;
    if (filter.dateFrom || filter.dateTo) {
      where.publishedAt = {
        ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
        ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
      };
    }

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
          author: { select: { name: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
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
        author: { select: { name: true, avatar: true } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }) as unknown as Promise<Partial<Article>[]>;
  }

  /**
   * Incrementa o contador simples do artigo e registra a leitura em
   * ArticleView de forma ATÔMICA — sem race condition.
   *
   * Comportamento:
   *   - viewCount (Article): sempre incrementa, em toda chamada. É o
   *     contador "bruto" de requisições à página — mantém o
   *     comportamento histórico, incluindo refreshes do mesmo visitante.
   *   - ArticleView: grava no máximo 1 registro por (artigo, IP, dia
   *     UTC). Refresh do mesmo visitante no mesmo dia não duplica.
   *     Bots/crawlers conhecidos (preview de redes sociais, SEO) não
   *     geram registro aqui, para não inflar "leitores únicos" — mas
   *     ainda contam no viewCount bruto, mantendo esse número como
   *     "hits totais" sem filtro.
   *
   * O insert é direto (sem findFirst prévio). Se já existir um registro
   * para esse (articleId, ipHash, viewBucket), o banco rejeita com
   * P2002 e nós simplesmente ignoramos — não há janela de tempo em que
   * dois requests concorrentes possam ambos "passar" pela checagem.
   */
  async incrementViewCount(id: string, visitorHash?: string, userAgent?: string): Promise<void> {
    await prisma.article.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    // Sem hash do visitante (ex: chamada interna/legada), só incrementa o contador simples
    if (!visitorHash) return;

    // Bots/crawlers conhecidos não geram registro de "leitor único"
    if (isLikelyBot(userAgent)) return;

    try {
      await prisma.articleView.create({
        data: {
          articleId: id,
          ipHash: visitorHash,
          userAgent: userAgent?.slice(0, 255) ?? null,
          viewBucket: utcDayBucket(),
        },
      });
    } catch (err: any) {
      // P2002 = violação da constraint única (articleId, ipHash, viewBucket)
      // — esse IP já leu esse artigo hoje. Comportamento esperado, não é erro.
      if (err?.code !== 'P2002') throw err;
    }
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

    return { total, published, draft, review, totalViews: viewsAgg._sum.viewCount || 0, last30Days };
  }
}