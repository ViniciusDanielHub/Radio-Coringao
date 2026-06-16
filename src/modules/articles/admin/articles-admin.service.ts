// src/modules/articles/admin/articles-admin.service.ts
import type { IArticleAdminRepository } from './articles-admin.repository.interface';
import type { ArticleStatus, ArticleType, Role } from '../../../shared/entities';
import { NotFoundError, AppError, ForbiddenError } from '../../../shared/errors';
import { deleteImage } from '../../../shared/services/cloudinary';
import { createUniqueSlug } from '../../../shared/services/slugify';
import {
  hasPermission,
  CAN_PUBLISH_ROLES,
  CAN_EDIT_ANY_ROLES,
  OWN_ARTICLES_ONLY_ROLES,
} from '../../../shared/plugins/permissions.plugin';
import type { SearchAdminFilter } from '../articles.types';

export class ArticleAdminService {
  constructor(private readonly repo: IArticleAdminRepository) { }

  // ─── Helpers de permissão ─────────────────────────────────
  private canPublish(role: Role): boolean {
    return CAN_PUBLISH_ROLES.includes(role);
  }

  private canEditAny(role: Role): boolean {
    return CAN_EDIT_ANY_ROLES.includes(role);
  }

  private ownsOnly(role: Role): boolean {
    return OWN_ARTICLES_ONLY_ROLES.includes(role);
  }

  private resolveStatus(requestedStatus: ArticleStatus | undefined, role: Role): ArticleStatus {
    const status = requestedStatus || 'DRAFT';
    if (status === 'PUBLISHED' && !this.canPublish(role)) return 'REVIEW';
    if (!hasPermission(role, 'articles:create')) return 'DRAFT';
    return status;
  }

  // ─── Listagem ─────────────────────────────────────────────
  async list(
    filter: {
      page?: number; limit?: number; status?: ArticleStatus;
      category?: string; type?: ArticleType; author?: string; q?: string;
    },
    userId: string,
    userRole: Role,
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.listAdmin(
      {
        authorId: this.ownsOnly(userRole) ? userId : undefined,
        status: filter.status,
        category: filter.category,
        type: filter.type,
        author: this.canEditAny(userRole) ? filter.author : undefined,
        q: filter.q,
      },
      { page, limit },
    );
  }

  // ─── Busca ────────────────────────────────────────────────
  async search(
    filter: SearchAdminFilter & { page?: number; limit?: number },
    userId: string,
    userRole: Role,
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.searchAdmin(
      {
        ...filter,
        authorId: this.ownsOnly(userRole) ? userId : undefined,
        author: this.canEditAny(userRole) ? filter.author : undefined,
      },
      { page, limit },
    );
  }

  // ─── Busca por ID ─────────────────────────────────────────
  async getById(id: string, userId: string, userRole: Role) {
    const article = await this.repo.findByIdAdmin(
      id,
      this.ownsOnly(userRole) ? userId : undefined,
    );
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    return article;
  }

  // ─── Criar ────────────────────────────────────────────────
  async create(
    data: {
      title: string; subtitle?: string; content: string; excerpt?: string;
      categoryId: string; type?: ArticleType; status?: ArticleStatus;
      isFeatured?: boolean; isBreaking?: boolean; isPinned?: boolean;
      coverImageAlt?: string; coverImageCredit?: string;
      metaTitle?: string; metaDescription?: string; scheduledAt?: string;
      tags?: string[];
    },
    userId: string,
    userRole: Role,
    coverImageUrl?: string,
  ) {
    if (!hasPermission(userRole, 'articles:create')) {
      throw new ForbiddenError('Seu cargo não permite criar artigos.');
    }

    const finalStatus = this.resolveStatus(data.status, userRole);
    const slug = await createUniqueSlug(data.title, (s, excl) => this.repo.slugExists(s, excl));

    return this.repo.create({
      title: data.title,
      subtitle: data.subtitle,
      slug,
      content: data.content,
      excerpt: data.excerpt,
      type: data.type || 'NEWS',
      status: finalStatus,
      isFeatured: this.canPublish(userRole) ? Boolean(data.isFeatured) : false,
      isBreaking: this.canPublish(userRole) ? Boolean(data.isBreaking) : false,
      isPinned: this.canPublish(userRole) ? Boolean(data.isPinned) : false,
      coverImage: coverImageUrl || null,
      coverImageAlt: data.coverImageAlt,
      coverImageCredit: data.coverImageCredit,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      publishedAt: finalStatus === 'PUBLISHED' ? new Date() : null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      authorId: userId,
      categoryId: data.categoryId,
      tagNames: data.tags,
    });
  }

  // ─── Editar ───────────────────────────────────────────────
  async update(
    id: string,
    data: {
      title?: string; subtitle?: string; content?: string; excerpt?: string;
      categoryId?: string; type?: ArticleType; status?: ArticleStatus;
      isFeatured?: boolean; isBreaking?: boolean; isPinned?: boolean;
      coverImageAlt?: string; coverImageCredit?: string;
      metaTitle?: string; metaDescription?: string; scheduledAt?: string;
      tags?: string[];
    },
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

    if (!canEdit) {
      throw new ForbiddenError('Você não tem permissão para editar este artigo.');
    }

    let finalStatus = data.status;
    if (finalStatus) finalStatus = this.resolveStatus(finalStatus, userRole);

    const updateData: any = {};

    if (data.title) {
      updateData.title = data.title;
      updateData.slug = await createUniqueSlug(
        data.title,
        (s, excl) => this.repo.slugExists(s, excl),
        id,
      );
    }
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.content) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.categoryId) updateData.categoryId = data.categoryId;
    if (data.type) updateData.type = data.type;

    if (finalStatus) {
      updateData.status = finalStatus;
      if (finalStatus === 'PUBLISHED' && !(existing as any).publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    if (this.canPublish(userRole)) {
      if (data.isFeatured !== undefined) updateData.isFeatured = Boolean(data.isFeatured);
      if (data.isBreaking !== undefined) updateData.isBreaking = Boolean(data.isBreaking);
      if (data.isPinned !== undefined) updateData.isPinned = Boolean(data.isPinned);
    }

    if (data.coverImageAlt !== undefined) updateData.coverImageAlt = data.coverImageAlt;
    if (data.coverImageCredit !== undefined) updateData.coverImageCredit = data.coverImageCredit;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }

    if (coverImageUrl) {
      if ((existing as any).coverImage) await deleteImage((existing as any).coverImage);
      updateData.coverImage = coverImageUrl;
    }

    if (data.tags !== undefined) updateData.tagNames = data.tags;

    return this.repo.update(id, updateData);
  }

  // ─── Mudar status ─────────────────────────────────────────
  async updateStatus(id: string, status: ArticleStatus, userRole: Role) {
    if (!['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      throw new AppError('Status inválido.', 400);
    }
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

  // ─── Deletar ──────────────────────────────────────────────
  async delete(id: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    if ((article as any).coverImage) await deleteImage((article as any).coverImage);
    for (const img of (article as any).images || []) await deleteImage(img.url);

    await this.repo.delete(id);
    return { message: 'Artigo deletado com sucesso.' };
  }

  // ─── Galeria ──────────────────────────────────────────────
  async addImage(
    articleId: string,
    imageUrl: string,
    body: { alt?: string; caption?: string; credit?: string },
  ) {
    const lastImage = await this.repo.findFirstImage(articleId);
    return this.repo.addImage({
      url: imageUrl,
      alt: body.alt,
      caption: body.caption,
      credit: body.credit,
      order: ((lastImage as any)?.order || 0) + 1,
      articleId,
    });
  }

  async deleteImage(articleId: string, imageId: string) {
    const image = await this.repo.findImage(imageId, articleId);
    if (!image) throw new NotFoundError('Imagem não encontrada.');
    await deleteImage((image as any).url);
    await this.repo.deleteImage(imageId);
    return { message: 'Imagem deletada.' };
  }
}