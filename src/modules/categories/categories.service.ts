// src/modules/categories/categories.service.ts
import type { ICategoryRepository } from './categories.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { createUniqueSlug } from '../../shared/services/slugify';

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export class CategoryService {
  constructor(private readonly repo: ICategoryRepository) { }

  async listPublic() { return this.repo.listPublic(); }
  async listAdmin() { return this.repo.listAdmin(); }

  async create(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    order?: number;
  }) {
    if (!data.name || data.name.trim() === '') {
      throw new ValidationError(ErrorCode.CATEGORY_NAME_REQUIRED);
    }
    if (data.color && !HEX_COLOR_RE.test(data.color)) {
      throw new ValidationError(ErrorCode.CATEGORY_COLOR_INVALID, { value: data.color });
    }

    const slug = await createUniqueSlug(
      data.name,
      async (s) => !!(await this.repo.findBySlug(s)),
    );

    // Checa nome duplicado
    const nameTaken = await this.repo.findBySlug(slug);
    // Se chegou aqui o slug já é único, mas checamos o name diretamente
    try {
      return await this.repo.create({
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        order: data.order ?? 0,
        isActive: true,
      });
    } catch (err: any) {
      // Captura violação unique do Prisma (P2002)
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? 'campo';
        if (field.includes('name')) {
          throw new ConflictError(ErrorCode.CATEGORY_NAME_TAKEN, { name: data.name });
        }
        if (field.includes('slug')) {
          throw new ConflictError(ErrorCode.CATEGORY_SLUG_TAKEN, { slug });
        }
      }
      throw err;
    }
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.CATEGORY_NOT_FOUND, { id });

    if (data.name !== undefined && data.name.trim() === '') {
      throw new ValidationError(ErrorCode.CATEGORY_NAME_REQUIRED);
    }
    if (data.color && !HEX_COLOR_RE.test(data.color)) {
      throw new ValidationError(ErrorCode.CATEGORY_COLOR_INVALID, { value: data.color });
    }

    const updateData: any = {};

    if (data.name) {
      updateData.name = data.name.trim();
      updateData.slug = await createUniqueSlug(
        data.name,
        async (s) => !!(await this.repo.findBySlug(s)),
        id,
      );
    }
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.color !== undefined) updateData.color = data.color ?? null;
    if (data.icon !== undefined) updateData.icon = data.icon ?? null;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    try {
      return await this.repo.update(id, updateData);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? '';
        if (field.includes('name')) throw new ConflictError(ErrorCode.CATEGORY_NAME_TAKEN, { name: data.name });
        if (field.includes('slug')) throw new ConflictError(ErrorCode.CATEGORY_SLUG_TAKEN);
      }
      throw err;
    }
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.CATEGORY_NOT_FOUND, { id });

    const count = await this.repo.countArticles(id);
    if (count > 0) {
      throw new ConflictError(ErrorCode.CATEGORY_HAS_ARTICLES, {
        categoryId: id,
        articleCount: count,
        hint: `Reatribua os ${count} artigo(s) a outra categoria antes de deletar.`,
      });
    }

    await this.repo.delete(id);
    return { message: 'Categoria deletada.' };
  }
}