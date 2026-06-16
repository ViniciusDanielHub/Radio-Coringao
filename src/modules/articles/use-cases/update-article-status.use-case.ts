// src/modules/articles/use-cases/update-article-status.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, Role } from '../../../shared/entities';
import { NotFoundError, AppError, ForbiddenError } from '../../../shared/errors';
import { hasPermission } from '../../../shared/plugins/permissions.plugin';

export class UpdateArticleStatusUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string, status: ArticleStatus, userRole: Role) {
    const validStatuses = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];
    if (!validStatuses.includes(status)) throw new AppError('Status inválido.', 400);

    if (status === 'PUBLISHED' && !hasPermission(userRole, 'articles:publish')) {
      throw new ForbiddenError('Seu cargo não permite publicar artigos diretamente.');
    }
    if (status === 'ARCHIVED' && !hasPermission(userRole, 'articles:archive')) {
      throw new ForbiddenError('Seu cargo não permite arquivar artigos.');
    }

    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    return this.repo.update(id, {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    });
  }
}
