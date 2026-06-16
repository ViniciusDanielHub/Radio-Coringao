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
