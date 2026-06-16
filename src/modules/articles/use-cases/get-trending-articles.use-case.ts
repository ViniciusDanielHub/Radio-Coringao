// src/modules/articles/use-cases/get-trending-articles.use-case.ts
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import type { TrendingFilter } from '../articles.types';

export class GetTrendingArticlesUseCase {
  constructor(private readonly repo: IArticlePublicRepository) { }

  async execute(input: {
    limit?: number;
    days?: number;
    categorySlug?: string;
  }) {
    const filter: TrendingFilter = {
      limit: Math.min(Number(input.limit) || 10, 50),
      days: Number(input.days) || 7,
      categorySlug: input.categorySlug,
    };

    const articles = await this.repo.findTrending(filter);

    return {
      period: `últimos ${filter.days} dias`,
      total: articles.length,
      articles,
    };
  }
}