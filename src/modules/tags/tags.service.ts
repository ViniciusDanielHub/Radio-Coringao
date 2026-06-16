// src/modules/tags/tags.service.ts
import type { ITagRepository } from './tags.repository';
import { NotFoundError, ConflictError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';

export class TagService {
  constructor(private readonly repo: ITagRepository) { }

  async list(q?: string) { return this.repo.list(q); }

  async delete(id: string) {
    const tag = await this.repo.findById(id);
    if (!tag) throw new NotFoundError(ErrorCode.TAG_NOT_FOUND, { id });

    // Checa artigos vinculados
    const count = await this.repo.countArticles(id);
    if (count > 0) {
      throw new ConflictError(ErrorCode.TAG_HAS_ARTICLES, {
        tagId: id,
        articleCount: count,
        hint: `Esta tag está associada a ${count} artigo(s). Remova-a dos artigos antes de deletar.`,
      });
    }

    await this.repo.delete(id);
    return { message: 'Tag deletada.' };
  }
}