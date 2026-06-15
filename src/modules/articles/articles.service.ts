// src/modules/articles/articles.service.ts
import type { IArticleRepository } from './articles.repository';
import type { ArticleStatus, ArticleType, Role } from '../../shared/entities';
import { NotFoundError, AppError, ForbiddenError } from '../../shared/errors';
import { deleteImage } from '../../shared/services/cloudinary';
import { createUniqueSlug } from '../../shared/services/slugify';

export class ArticleService {
  constructor(private readonly repo: IArticleRepository) {}

  async listPublic(filter: {
    page?: number; limit?: number; category?: string; tag?: string;
    type?: ArticleType; featured?: string; breaking?: string; q?: string;
  }) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.listPublic(
      {
        category: filter.category,
        tag: filter.tag,
        type: filter.type,
        featured: filter.featured === 'true',
        breaking: filter.breaking === 'true',
        q: filter.q,
      },
      { page, limit },
    );
  }

  async getPublicBySlug(slug: string) {
    const article = await this.repo.findBySlugPublic(slug);
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    this.repo.incrementViewCount(article.id).catch(() => {});
    return article;
  }

  async listAdmin(
    filter: { page?: number; limit?: number; status?: ArticleStatus; category?: string; type?: ArticleType; author?: string; q?: string },
    userId: string,
    userRole: Role,
  ) {
    const page = Number(filter.page) || 1;
    const limit = Number(filter.limit) || 20;
    return this.repo.listAdmin(
      {
        authorId: userRole === 'REPORTER' ? userId : undefined,
        status: filter.status,
        category: filter.category,
        type: filter.type,
        author: userRole !== 'REPORTER' ? filter.author : undefined,
        q: filter.q,
      },
      { page, limit },
    );
  }

  async getAdminById(id: string, userId: string, userRole: Role) {
    const article = await this.repo.findByIdAdmin(id, userRole === 'REPORTER' ? userId : undefined);
    if (!article) throw new NotFoundError('Artigo não encontrado.');
    return article;
  }

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
    let finalStatus = data.status || 'DRAFT';
    if (userRole === 'REPORTER' && finalStatus === 'PUBLISHED') finalStatus = 'REVIEW';

    const slug = await createUniqueSlug(data.title, (s, excl) => this.repo.slugExists(s, excl));

    return this.repo.create({
      title: data.title,
      subtitle: data.subtitle,
      slug,
      content: data.content,
      excerpt: data.excerpt,
      type: data.type || 'NEWS',
      status: finalStatus,
      isFeatured: Boolean(data.isFeatured),
      isBreaking: Boolean(data.isBreaking),
      isPinned: Boolean(data.isPinned),
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

    if (userRole === 'REPORTER' && (existing as any).authorId !== userId) {
      throw new ForbiddenError('Acesso negado.');
    }

    let finalStatus = data.status;
    if (userRole === 'REPORTER' && finalStatus === 'PUBLISHED') finalStatus = 'REVIEW';

    const updateData: any = {};
    if (data.title) {
      updateData.title = data.title;
      updateData.slug = await createUniqueSlug(data.title, (s, excl) => this.repo.slugExists(s, excl), id);
    }
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle;
    if (data.content) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.categoryId) updateData.categoryId = data.categoryId;
    if (data.type) updateData.type = data.type;
    if (finalStatus) {
      updateData.status = finalStatus;
      if (finalStatus === 'PUBLISHED' && !(existing as any).publishedAt) updateData.publishedAt = new Date();
    }
    if (data.isFeatured !== undefined) updateData.isFeatured = Boolean(data.isFeatured);
    if (data.isBreaking !== undefined) updateData.isBreaking = Boolean(data.isBreaking);
    if (data.isPinned !== undefined) updateData.isPinned = Boolean(data.isPinned);
    if (data.coverImageAlt !== undefined) updateData.coverImageAlt = data.coverImageAlt;
    if (data.coverImageCredit !== undefined) updateData.coverImageCredit = data.coverImageCredit;
    if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) updateData.metaDescription = data.metaDescription;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

    if (coverImageUrl) {
      if ((existing as any).coverImage) await deleteImage((existing as any).coverImage);
      updateData.coverImage = coverImageUrl;
    }

    if (data.tags !== undefined) updateData.tagNames = data.tags;

    return this.repo.update(id, updateData);
  }

  async updateStatus(id: string, status: ArticleStatus, userRole: Role) {
    if (!['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      throw new AppError('Status inválido.', 400);
    }
    if (userRole === 'REPORTER' && status === 'PUBLISHED') {
      throw new ForbiddenError('Repórteres não podem publicar diretamente.');
    }

    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    return this.repo.update(id, {
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : undefined,
    });
  }

  async delete(id: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    if ((article as any).coverImage) await deleteImage((article as any).coverImage);
    for (const img of (article as any).images || []) await deleteImage(img.url);

    await this.repo.delete(id);
    return { message: 'Artigo deletado com sucesso.' };
  }

  async addImage(articleId: string, imageUrl: string, body: { alt?: string; caption?: string; credit?: string }) {
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
