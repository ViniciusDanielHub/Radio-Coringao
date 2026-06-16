// src/modules/articles/use-cases/search-admin-articles.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { Role } from '../../../shared/entities';
import type { SearchAdminFilter } from '../articles.types';
import { OWN_ARTICLES_ONLY_ROLES, CAN_EDIT_ANY_ROLES } from '../../../shared/plugins/permissions.plugin';

export class SearchAdminArticlesUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    filter: SearchAdminFilter & { page?: number; limit?: number },
    userId: string,
    userRole: Role,
  ) {
    const page     = Number(filter.page)  || 1;
    const limit    = Number(filter.limit) || 20;
    const ownsOnly   = OWN_ARTICLES_ONLY_ROLES.includes(userRole);
    const canEditAny = CAN_EDIT_ANY_ROLES.includes(userRole);

    return this.repo.searchAdmin(
      {
        ...filter,
        authorId: ownsOnly   ? userId        : undefined,
        author:   canEditAny ? filter.author : undefined,
      },
      { page, limit },
    );
  }
}
