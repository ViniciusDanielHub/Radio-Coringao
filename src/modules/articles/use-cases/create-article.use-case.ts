// src/modules/articles/use-cases/create-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { ForbiddenError } from '../../../shared/errors';
import { createUniqueSlug } from '../../../shared/services/slugify';
import {
  hasPermission,
  CAN_PUBLISH_ROLES,
} from '../../../shared/plugins/permissions.plugin';

export interface CreateArticleInput {
  title: string;
  subtitle?: string;
  content: string;
  excerpt?: string;
  categoryId: string;
  type?: ArticleType;
  status?: ArticleStatus;
  isFeatured?: boolean;
  isBreaking?: boolean;
  isPinned?: boolean;
  coverImageAlt?: string;
  coverImageCredit?: string;
  metaTitle?: string;
  metaDescription?: string;
  scheduledAt?: string;
  tags?: string[];
}

export class CreateArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    input: CreateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    if (!hasPermission(userRole, 'articles:create')) {
      throw new ForbiddenError('Seu cargo não permite criar artigos.');
    }

    const canPublish  = CAN_PUBLISH_ROLES.includes(userRole);
    const finalStatus = this.resolveStatus(input.status, userRole);
    const slug        = await createUniqueSlug(
      input.title,
      (s, excl) => this.repo.slugExists(s, excl),
    );

    return this.repo.create({
      title:             input.title,
      subtitle:          input.subtitle,
      slug,
      content:           input.content,
      excerpt:           input.excerpt,
      type:              input.type || 'NEWS',
      status:            finalStatus,
      isFeatured:        canPublish ? Boolean(input.isFeatured) : false,
      isBreaking:        canPublish ? Boolean(input.isBreaking) : false,
      isPinned:          canPublish ? Boolean(input.isPinned)   : false,
      coverImage:        coverImageUrl || null,
      coverImageAlt:     input.coverImageAlt,
      coverImageCredit:  input.coverImageCredit,
      metaTitle:         input.metaTitle,
      metaDescription:   input.metaDescription,
      publishedAt:       finalStatus === 'PUBLISHED' ? new Date() : null,
      scheduledAt:       input.scheduledAt ? new Date(input.scheduledAt) : null,
      authorId:          userId,
      categoryId:        input.categoryId,
      tagNames:          input.tags,
    });
  }

  private resolveStatus(requested: ArticleStatus | undefined, role: Role): ArticleStatus {
    const status = requested || 'DRAFT';
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    if (!hasPermission(role, 'articles:create')) return 'DRAFT';
    return status;
  }
}
