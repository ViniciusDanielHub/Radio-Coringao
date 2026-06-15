// src/modules/categories/categories.service.ts
import type { ICategoryRepository } from './categories.repository';
import { ConflictError } from '../../shared/errors';
import { createUniqueSlug } from '../../shared/services/slugify';

export class CategoryService {
  constructor(private readonly repo: ICategoryRepository) {}

  async listPublic() { return this.repo.listPublic(); }
  async listAdmin() { return this.repo.listAdmin(); }

  async create(data: { name: string; description?: string; color?: string; icon?: string; order?: number }) {
    const slug = await createUniqueSlug(data.name, async (s) => !!(await this.repo.findBySlug(s)));
    return this.repo.create({ name: data.name, slug, description: data.description, color: data.color, icon: data.icon, order: data.order || 0, isActive: true });
  }

  async update(id: string, data: { name?: string; description?: string; color?: string; icon?: string; order?: number; isActive?: boolean }) {
    const updateData: any = {};
    if (data.name) {
      updateData.name = data.name;
      updateData.slug = await createUniqueSlug(data.name, async (s) => !!(await this.repo.findBySlug(s)), id);
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const count = await this.repo.countArticles(id);
    if (count > 0) throw new ConflictError(`Categoria possui ${count} artigo(s). Reatribua-os antes de deletar.`);
    await this.repo.delete(id);
    return { message: 'Categoria deletada.' };
  }
}
