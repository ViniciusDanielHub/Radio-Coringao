// src/modules/articles/use-cases/update-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { NotFoundError, ForbiddenError } from '../../../shared/errors';
import { createUniqueSlug } from '../../../shared/services/slugify';
import { deleteImage } from '../../../shared/services/cloudinary';
import {
  hasPermission,
  CAN_PUBLISH_ROLES,
} from '../../../shared/plugins/permissions.plugin';

export interface UpdateArticleInput {
  title?: string;
  subtitle?: string;
  content?: string;
  excerpt?: string;
  categoryId?: string;
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

export class UpdateArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    id: string,
    input: UpdateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Artigo não encontrado.');

    const isOwner = (existing as any).authorId === userId;
    const canEdit =
      hasPermission(userRole, 'articles:edit_any') ||
      (hasPermission(userRole, 'articles:edit_own') && isOwner);

    if (!canEdit) throw new ForbiddenError('Você não tem permissão para editar este artigo.');

    const canPublish  = CAN_PUBLISH_ROLES.includes(userRole);
    const updateData: any = {};

    if (input.title) {
      updateData.title = input.title;
      updateData.slug  = await createUniqueSlug(
        input.title,
        (s, excl) => this.repo.slugExists(s, excl),
        id,
      );
    }

    if (input.subtitle     !== undefined) updateData.subtitle     = input.subtitle;
    if (input.content)                    updateData.content      = input.content;
    if (input.excerpt      !== undefined) updateData.excerpt      = input.excerpt;
    if (input.categoryId)                 updateData.categoryId   = input.categoryId;
    if (input.type)                       updateData.type         = input.type;
    if (input.metaTitle    !== undefined) updateData.metaTitle    = input.metaTitle;
    if (input.metaDescription !== undefined) updateData.metaDescription = input.metaDescription;
    if (input.coverImageAlt   !== undefined) updateData.coverImageAlt   = input.coverImageAlt;
    if (input.coverImageCredit !== undefined) updateData.coverImageCredit = input.coverImageCredit;
    if (input.scheduledAt !== undefined) {
      updateData.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    }

    if (input.status) {
      const finalStatus = this.resolveStatus(input.status, userRole);
      updateData.status = finalStatus;
      if (finalStatus === 'PUBLISHED' && !(existing as any).publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (canPublish) {
      if (input.isFeatured !== undefined) updateData.isFeatured = Boolean(input.isFeatured);
      if (input.isBreaking !== undefined) updateData.isBreaking = Boolean(input.isBreaking);
      if (input.isPinned   !== undefined) updateData.isPinned   = Boolean(input.isPinned);
    }

    if (coverImageUrl) {
      if ((existing as any).coverImage) await deleteImage((existing as any).coverImage);
      updateData.coverImage = coverImageUrl;
    }

    if (input.tags !== undefined) updateData.tagNames = input.tags;

    return this.repo.update(id, updateData);
  }

  private resolveStatus(status: ArticleStatus, role: Role): ArticleStatus {
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    return status;
  }
}
