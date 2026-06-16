// src/modules/articles/public/articles-public.service.ts
import type { IArticleRepository, SearchPublicFilter } from '../articles.repository';
import type { ArticleType } from '../../../shared/entities';
import { NotFoundError } from '../../../shared/errors';

export class ArticlePublicService {
  constructor(private readonly repo: IArticleRepository) { }

  async list(filter: {
    page?: number; limit?: number; category?: string; tag?: string;
    type?: ArticleType; featured?: string; breaking?: string; q?: string;
  }) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.listPublic(
      {
        category: filter.category,
        tag: filter.tag,
        type: filter.type,
        featured: filter.featured === 'true',
        breaking: filter.breaking === 'true',
        q: filter.q,
      },
      { page, limit },
    );
  }

  async getBySlug(slug: string) {
    const article = await this.repo.findBySlugPublic(slug);
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    this.repo.incrementViewCount(article.id).catch(() => { });
    return article;
  }

  async search(filter: SearchPublicFilter & { page?: number; limit?: number }) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.search(filter, { page, limit });
  }
}