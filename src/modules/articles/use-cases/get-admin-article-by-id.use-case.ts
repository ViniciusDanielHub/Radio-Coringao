// src/modules/articles/use-cases/get-admin-article-by-id.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Role } from '../../../shared/entities';
import { NotFoundError } from '../../../shared/errors';
import { OWN_ARTICLES_ONLY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class GetAdminArticleByIdUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string, userId: string, userRole: Role) {
    const ownsOnly = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const article  = await this.repo.findByIdAdmin(id, ownsOnly ? userId : undefined);
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    return article;
  }
}
