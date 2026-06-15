// src/modules/menu/menu.service.ts
import type { IMenuRepository } from './menu.repository';

export class MenuService {
  constructor(private readonly repo: IMenuRepository) {}

  async getPublic() { return this.repo.getPublic(); }
  async getAdmin() { return this.repo.getAdmin(); }

  async create(data: { label: string; url: string; target?: string; order?: number; parentId?: string }) {
    return this.repo.create({ label: data.label, url: data.url, target: data.target || '_self', order: data.order || 0, parentId: data.parentId, isActive: true });
  }

  async update(id: string, data: { label?: string; url?: string; target?: string; order?: number; isActive?: boolean; parentId?: string }) {
    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.target !== undefined) updateData.target = data.target;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.order !== undefined) updateData.order = Number(data.order);
    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    await this.repo.deleteChildren(id);
    await this.repo.delete(id);
    return { message: 'Item de menu deletado.' };
  }
}
