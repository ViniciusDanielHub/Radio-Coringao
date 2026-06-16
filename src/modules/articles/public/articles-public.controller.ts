// src/modules/articles/public/articles-public.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListArticlesUseCase } from '../use-cases/list-articles.use-case';
import type { GetArticleBySlugUseCase } from '../use-cases/get-article-by-slug.use-case';
import type { SearchArticlesUseCase } from '../use-cases/search-articles.use-case';
import type { GetTrendingArticlesUseCase } from '../use-cases/get-trending-articles.use-case';

export class ArticlePublicController {
  constructor(
    private readonly listUseCase: ListArticlesUseCase,
    private readonly getBySlugUseCase: GetArticleBySlugUseCase,
    private readonly searchUseCase: SearchArticlesUseCase,
    private readonly trendingUseCase: GetTrendingArticlesUseCase,
  ) { }

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

  trending = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit, days, category } = request.query as {
      limit?: string;
      days?: string;
      category?: string;
    };
    return reply.send(
      await this.trendingUseCase.execute({
        limit: limit ? Number(limit) : undefined,
        days: days ? Number(days) : undefined,
        categorySlug: category,
      }),
    );
  };
}