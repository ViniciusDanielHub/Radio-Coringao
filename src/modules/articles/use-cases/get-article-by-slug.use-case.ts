// src/modules/articles/use-cases/get-article-by-slug.use-case.ts
import type { IArticlePublicRepository } from '../repositories/article-public.repository.interface';
import { NotFoundError } from '../../../shared/errors';

export class GetArticleBySlugUseCase {
  constructor(private readonly repo: IArticlePublicRepository) { }

  async execute(slug: string, visitor?: { ipHash?: string; userAgent?: string }) {
    const article = await this.repo.findBySlugPublic(slug);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    // fire-and-forget — não bloqueia a resposta
    this.repo
      .incrementViewCount(article.id, visitor?.ipHash, visitor?.userAgent)
      .catch(() => { });

    return article;
  }
}