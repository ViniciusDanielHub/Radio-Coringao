// src/modules/articles/use-cases/update-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { NotFoundError, ForbiddenError, ValidationError } from '../../../shared/errors';
import { ErrorCode } from '../../../shared/errors/error-codes';
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

const VALID_TYPES: ArticleType[] = ['NEWS', 'ANALYSIS', 'INTERVIEW', 'LIVE', 'GALLERY'];
const VALID_STATUSES: ArticleStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

export class UpdateArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) { }

  async execute(
    id: string,
    input: UpdateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    // ── Artigo existe ──
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.ARTICLE_NOT_FOUND, { id });

    // ── Permissão de edição ──
    const isOwner = (existing as any).authorId === userId;
    const canEditAny = hasPermission(userRole, 'articles:edit_any');
    const canEditOwn = hasPermission(userRole, 'articles:edit_own') && isOwner;

    if (!canEditAny && !canEditOwn) {
      throw new ForbiddenError(ErrorCode.ARTICLE_FORBIDDEN_EDIT, {
        articleId: id,
        ownerId: (existing as any).authorId,
        requesterId: userId,
      });
    }

    // ── Título: validações se fornecido ──
    if (input.title !== undefined) {
      if (input.title.trim() === '') {
        throw new ValidationError(ErrorCode.ARTICLE_TITLE_REQUIRED);
      }
      if (input.title.trim().length > 255) {
        throw new ValidationError(ErrorCode.ARTICLE_TITLE_TOO_LONG, {
          max: 255,
          length: input.title.trim().length,
        });
      }
    }

    // ── Conteúdo: não pode ficar vazio se fornecido ──
    if (input.content !== undefined && input.content.trim() === '') {
      throw new ValidationError(ErrorCode.ARTICLE_CONTENT_REQUIRED);
    }

    // ── Tipo válido ──
    if (input.type && !VALID_TYPES.includes(input.type)) {
      throw new ValidationError(ErrorCode.ARTICLE_INVALID_TYPE, {
        received: input.type,
        accepted: VALID_TYPES,
      });
    }

    // ── Status válido ──
    if (input.status && !VALID_STATUSES.includes(input.status)) {
      throw new ValidationError(ErrorCode.ARTICLE_INVALID_STATUS, {
        received: input.status,
        accepted: VALID_STATUSES,
      });
    }

    // ── Categoria existe (se fornecida) ──
    if (input.categoryId) {
      const categoryExists = await this.repo.categoryExists(input.categoryId);
      if (!categoryExists) {
        throw new NotFoundError(ErrorCode.ARTICLE_CATEGORY_NOT_FOUND, {
          categoryId: input.categoryId,
        });
      }
    }

    // ── scheduledAt no futuro ──
    let scheduledAt: Date | null | undefined = undefined;
    if (input.scheduledAt !== undefined) {
      if (input.scheduledAt === null || input.scheduledAt === '') {
        scheduledAt = null;
      } else {
        const d = new Date(input.scheduledAt as string);
        if (isNaN(d.getTime())) {
          throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
            field: 'scheduledAt',
            value: input.scheduledAt,
          });
        }
        if (d <= new Date()) {
          throw new ValidationError(ErrorCode.ARTICLE_SCHEDULED_PAST, {
            field: 'scheduledAt',
            value: input.scheduledAt,
          });
        }
        scheduledAt = d;
      }
    }

    // ── SEO ──
    if (input.metaTitle && input.metaTitle.length > 60) {
      throw new ValidationError(ErrorCode.VALIDATION_STRING_TOO_LONG, {
        field: 'metaTitle',
        max: 60,
        length: input.metaTitle.length,
      });
    }
    if (input.metaDescription && input.metaDescription.length > 160) {
      throw new ValidationError(ErrorCode.VALIDATION_STRING_TOO_LONG, {
        field: 'metaDescription',
        max: 160,
        length: input.metaDescription.length,
      });
    }

    const canPublish = CAN_PUBLISH_ROLES.includes(userRole);
    const updateData: any = {};

    if (input.title) {
      updateData.title = input.title.trim();
      updateData.slug = await createUniqueSlug(
        input.title,
        (s, excl) => this.repo.slugExists(s, excl),
        id,
      );
    }

    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle?.trim() ?? null;
    if (input.content) updateData.content = input.content;
    if (input.excerpt !== undefined) updateData.excerpt = input.excerpt?.trim() ?? null;
    if (input.categoryId) updateData.categoryId = input.categoryId;
    if (input.type) updateData.type = input.type;
    if (input.metaTitle !== undefined) updateData.metaTitle = input.metaTitle?.trim() ?? null;
    if (input.metaDescription !== undefined) updateData.metaDescription = input.metaDescription?.trim() ?? null;
    if (input.coverImageAlt !== undefined) updateData.coverImageAlt = input.coverImageAlt?.trim() ?? null;
    if (input.coverImageCredit !== undefined) updateData.coverImageCredit = input.coverImageCredit?.trim() ?? null;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt;

    if (input.status) {
      const finalStatus = this.resolveStatus(input.status, userRole);
      updateData.status = finalStatus;
      if (finalStatus === 'PUBLISHED' && !(existing as any).publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    // Apenas cargos que podem publicar alteram flags editoriais
    if (canPublish) {
      if (input.isFeatured !== undefined) updateData.isFeatured = Boolean(input.isFeatured);
      if (input.isBreaking !== undefined) updateData.isBreaking = Boolean(input.isBreaking);
      if (input.isPinned !== undefined) updateData.isPinned = Boolean(input.isPinned);
    }

    if (coverImageUrl) {
      if ((existing as any).coverImage) {
        await deleteImage((existing as any).coverImage).catch(() => {
          // não bloqueia a atualização se a deleção da imagem antiga falhar
        });
      }
      updateData.coverImage = coverImageUrl;
    }

    if (input.tags !== undefined) {
      updateData.tagNames = input.tags.filter(t => t.trim() !== '');
    }

    return this.repo.update(id, updateData);
  }

  private resolveStatus(status: ArticleStatus, role: Role): ArticleStatus {
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    return status;
  }
}