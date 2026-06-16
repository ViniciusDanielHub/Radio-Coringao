import type { ICategoryRepository } from './categories.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { createUniqueSlug } from '../../shared/services/slugify';
import { logger as rootLogger, type Logger } from '../../shared/logger';

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export class CategoryService {
  private readonly log: Logger;

  constructor(
    private readonly repo: ICategoryRepository,
    log?: Logger,
  ) {
    this.log = log ?? rootLogger.child({ service: 'CategoryService' });
  }

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

    // Nota: não há necessidade de checar slug/name antes do create —
    // o índice UNIQUE do banco já garante isso e o erro P2002 é capturado abaixo.
    // A variável `nameTaken` que existia antes era código morto (nunca lida).
    try {
      const category = await this.repo.create({
        name: data.name.trim(),
        slug,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
        order: data.order ?? 0,
        isActive: true,
      });

      this.log.info({ categoryId: (category as any).id, slug }, 'Categoria criada');
      return category;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const field = err?.meta?.target?.[0] ?? 'campo';
        if (field.includes('name')) throw new ConflictError(ErrorCode.CATEGORY_NAME_TAKEN, { name: data.name });
        if (field.includes('slug')) throw new ConflictError(ErrorCode.CATEGORY_SLUG_TAKEN, { slug });
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
      const category = await this.repo.update(id, updateData);
      this.log.info({ categoryId: id, changedFields: Object.keys(updateData) }, 'Categoria atualizada');
      return category;
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
    this.log.info({ categoryId: id }, 'Categoria deletada');
    return { message: 'Categoria deletada.' };
  }
}