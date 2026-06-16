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
