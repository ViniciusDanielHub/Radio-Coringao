import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors';
import { ErrorCode } from '../../../shared/errors/error-codes';
import { createUniqueSlug } from '../../../shared/services/slugify';
import { logger as rootLogger, type Logger } from '../../../shared/logger';
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

const VALID_TYPES: ArticleType[] = ['NEWS', 'ANALYSIS', 'INTERVIEW', 'LIVE', 'GALLERY'];
const VALID_STATUSES: ArticleStatus[] = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'];

export class CreateArticleUseCase {
  private readonly log: Logger;

  constructor(
    private readonly repo: IArticleAdminRepository,
    log?: Logger,
  ) {
    // Permite injetar um logger filho com requestId para correlação por requisição
    this.log = log ?? rootLogger.child({ useCase: 'CreateArticle' });
  }

  async execute(
    input: CreateArticleInput,
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    // ── Permissão ──
    if (!hasPermission(userRole, 'articles:create')) {
      this.log.warn({ userId, userRole }, 'Tentativa de criar artigo sem permissão');
      throw new ForbiddenError('Seu cargo não permite criar artigos.');
    }

    // ── Título obrigatório ──
    if (!input.title || input.title.trim() === '') {
      throw new ValidationError(ErrorCode.ARTICLE_TITLE_REQUIRED);
    }
    if (input.title.trim().length > 255) {
      throw new ValidationError(ErrorCode.ARTICLE_TITLE_TOO_LONG, {
        max: 255,
        length: input.title.trim().length,
      });
    }

    // ── Conteúdo obrigatório ──
    if (!input.content || input.content.trim() === '') {
      throw new ValidationError(ErrorCode.ARTICLE_CONTENT_REQUIRED);
    }

    // ── CategoryId obrigatório ──
    if (!input.categoryId || input.categoryId.trim() === '') {
      throw new ValidationError(ErrorCode.ARTICLE_CATEGORY_REQUIRED);
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

    // ── Categoria existe ──
    const categoryExists = await this.repo.categoryExists(input.categoryId);
    if (!categoryExists) {
      throw new NotFoundError(ErrorCode.ARTICLE_CATEGORY_NOT_FOUND, {
        categoryId: input.categoryId,
      });
    }

    // ── Data de agendamento no futuro ──
    let scheduledAt: Date | null = null;
    if (input.scheduledAt) {
      scheduledAt = new Date(input.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
          field: 'scheduledAt',
          value: input.scheduledAt,
        });
      }
      if (scheduledAt <= new Date()) {
        throw new ValidationError(ErrorCode.ARTICLE_SCHEDULED_PAST, {
          field: 'scheduledAt',
          value: input.scheduledAt,
        });
      }
    }

    // ── Metadados SEO ──
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

    // ── resolveStatus() determina o status final com base no cargo.
    //    canPublish é usado APENAS para as flags editoriais (isFeatured/isBreaking/isPinned)
    //    abaixo — não para o status, que já está encapsulado em resolveStatus(). ──
    const canPublish = CAN_PUBLISH_ROLES.includes(userRole);
    const finalStatus = this.resolveStatus(input.status, userRole);

    const slug = await createUniqueSlug(
      input.title,
      (s, excl) => this.repo.slugExists(s, excl),
    );

    // Log quando o status pedido foi rebaixado (ex: JORNALISTA pediu PUBLISHED → REVIEW)
    if (input.status && input.status !== finalStatus) {
      this.log.info(
        { userId, userRole, requestedStatus: input.status, finalStatus },
        'Status do artigo ajustado conforme permissão do cargo',
      );
    }

    const article = await this.repo.create({
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() ?? undefined,
      slug,
      content: input.content,
      excerpt: input.excerpt?.trim() ?? undefined,
      type: input.type || 'NEWS',
      status: finalStatus,
      // canPublish controla exclusivamente as flags editoriais visíveis no portal
      isFeatured: canPublish ? Boolean(input.isFeatured) : false,
      isBreaking: canPublish ? Boolean(input.isBreaking) : false,
      isPinned: canPublish ? Boolean(input.isPinned) : false,
      coverImage: coverImageUrl || null,
      coverImageAlt: input.coverImageAlt?.trim() ?? undefined,
      coverImageCredit: input.coverImageCredit?.trim() ?? undefined,
      metaTitle: input.metaTitle?.trim() ?? undefined,
      metaDescription: input.metaDescription?.trim() ?? undefined,
      publishedAt: finalStatus === 'PUBLISHED' ? new Date() : null,
      scheduledAt,
      authorId: userId,
      categoryId: input.categoryId,
      tagNames: input.tags?.filter(t => t.trim() !== ''),
    });

    this.log.info(
      { articleId: (article as any).id, slug, status: finalStatus, userId, userRole },
      'Artigo criado',
    );

    return article;
  }

  private resolveStatus(requested: ArticleStatus | undefined, role: Role): ArticleStatus {
    const status = requested || 'DRAFT';
    if (status === 'PUBLISHED' && !CAN_PUBLISH_ROLES.includes(role)) return 'REVIEW';
    if (!hasPermission(role, 'articles:create')) return 'DRAFT';
    return status;
  }
}