// src/modules/menu/menu.service.ts
import type { IMenuRepository } from './menu.repository';
import { NotFoundError, ValidationError, AppError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';

const VALID_TARGETS = ['_self', '_blank'];

export class MenuService {
  constructor(private readonly repo: IMenuRepository) { }

  async getPublic() { return this.repo.getPublic(); }
  async getAdmin() { return this.repo.getAdmin(); }

  async create(data: {
    label: string;
    url: string;
    target?: string;
    order?: number;
    parentId?: string;
  }) {
    if (!data.label || data.label.trim() === '') {
      throw new ValidationError(ErrorCode.MENU_LABEL_REQUIRED);
    }
    if (!data.url || data.url.trim() === '') {
      throw new ValidationError(ErrorCode.MENU_URL_REQUIRED);
    }
    if (data.target && !VALID_TARGETS.includes(data.target)) {
      throw new ValidationError(ErrorCode.VALIDATION_INVALID_FORMAT, {
        field: 'target',
        received: data.target,
        accepted: VALID_TARGETS,
      });
    }

    // Valida existência do parentId
    if (data.parentId) {
      const parent = await this.repo.findById(data.parentId);
      if (!parent) {
        throw new NotFoundError(ErrorCode.MENU_PARENT_NOT_FOUND, { parentId: data.parentId });
      }
      // Impede mais de 2 níveis
      if ((parent as any).parentId) {
        throw new AppError(
          ErrorCode.MENU_MAX_DEPTH_EXCEEDED,
          400,
          ErrorCode.MENU_MAX_DEPTH_EXCEEDED,
          { parentId: data.parentId },
        );
      }
    }

    return this.repo.create({
      label: data.label.trim(),
      url: data.url.trim(),
      target: data.target ?? '_self',
      order: data.order ?? 0,
      parentId: data.parentId ?? null,
      isActive: true,
    });
  }

  async update(
    id: string,
    data: {
      label?: string;
      url?: string;
      target?: string;
      order?: number;
      isActive?: boolean;
      parentId?: string;
    },
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.MENU_ITEM_NOT_FOUND, { id });

    if (data.label !== undefined && data.label.trim() === '') {
      throw new ValidationError(ErrorCode.MENU_LABEL_REQUIRED);
    }
    if (data.url !== undefined && data.url.trim() === '') {
      throw new ValidationError(ErrorCode.MENU_URL_REQUIRED);
    }
    if (data.target && !VALID_TARGETS.includes(data.target)) {
      throw new ValidationError(ErrorCode.VALIDATION_INVALID_FORMAT, {
        field: 'target',
        received: data.target,
        accepted: VALID_TARGETS,
      });
    }

    // Valida parentId
    if (data.parentId !== undefined && data.parentId !== null) {
      // Referência circular
      if (data.parentId === id) {
        throw new AppError(
          ErrorCode.MENU_CIRCULAR_REFERENCE,
          400,
          ErrorCode.MENU_CIRCULAR_REFERENCE,
          { id, parentId: data.parentId },
        );
      }
      const parent = await this.repo.findById(data.parentId);
      if (!parent) {
        throw new NotFoundError(ErrorCode.MENU_PARENT_NOT_FOUND, { parentId: data.parentId });
      }
      if ((parent as any).parentId) {
        throw new AppError(
          ErrorCode.MENU_MAX_DEPTH_EXCEEDED,
          400,
          ErrorCode.MENU_MAX_DEPTH_EXCEEDED,
        );
      }
    }

    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label.trim();
    if (data.url !== undefined) updateData.url = data.url.trim();
    if (data.target !== undefined) updateData.target = data.target;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.parentId !== undefined) updateData.parentId = data.parentId ?? null;
    if (data.order !== undefined) updateData.order = Number(data.order);

    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.MENU_ITEM_NOT_FOUND, { id });

    await this.repo.deleteChildren(id);
    await this.repo.delete(id);
    return { message: 'Item de menu deletado.' };
  }
}