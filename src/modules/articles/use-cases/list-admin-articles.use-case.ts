// src/modules/articles/use-cases/list-admin-articles.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { OWN_ARTICLES_ONLY_ROLES, CAN_EDIT_ANY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class ListAdminArticlesUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    filter: {
      page?: number; limit?: number; status?: ArticleStatus;
      category?: string; type?: ArticleType; author?: string; q?: string;
    },
    userId: string,
    userRole: Role,
  ) {
    const page  = Number(filter.page)  || 1;
    const limit = Number(filter.limit) || 20;
    const ownsOnly   = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const canEditAny = CAN_EDIT_ANY_ROLES.includes(userRole);

    return this.repo.listAdmin(
      {
        authorId: ownsOnly ? userId : undefined,
        status:   filter.status,
        category: filter.category,
        type:     filter.type,
        author:   canEditAny ? filter.author : undefined,
        q:        filter.q,
      },
      { page, limit },
    );
  }
}
