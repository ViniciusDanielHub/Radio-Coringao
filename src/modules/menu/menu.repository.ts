// src/modules/menu/menu.repository.ts
import { prisma } from '../../shared/database/prisma';
import type { MenuItem } from '../../shared/entities';

export interface IMenuRepository {
  findById(id: string): Promise<MenuItem | null>;
  getPublic(): Promise<MenuItem[]>;
  getAdmin(): Promise<MenuItem[]>;
  create(data: Omit<MenuItem, 'id' | 'createdAt'>): Promise<MenuItem>;
  update(id: string, data: Partial<MenuItem>): Promise<MenuItem>;
  delete(id: string): Promise<void>;
  deleteChildren(parentId: string): Promise<void>;
}

export class MenuRepository implements IMenuRepository {
  async findById(id: string): Promise<MenuItem | null> {
    return prisma.menuItem.findUnique({ where: { id } }) as Promise<MenuItem | null>;
  }

  async getPublic(): Promise<MenuItem[]> {
    return prisma.menuItem.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { order: 'asc' },
      include: {
        children: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    }) as unknown as Promise<MenuItem[]>;
  }

  async getAdmin(): Promise<MenuItem[]> {
    return prisma.menuItem.findMany({
      where: { parentId: null },
      orderBy: { order: 'asc' },
      include: {
        children: { orderBy: { order: 'asc' } },
      },
    }) as unknown as Promise<MenuItem[]>;
  }

  async create(data: Omit<MenuItem, 'id' | 'createdAt'>): Promise<MenuItem> {
    return prisma.menuItem.create({ data }) as Promise<MenuItem>;
  }

  async update(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    return prisma.menuItem.update({ where: { id }, data }) as Promise<MenuItem>;
  }

  async delete(id: string): Promise<void> {
    await prisma.menuItem.delete({ where: { id } });
  }

  async deleteChildren(parentId: string): Promise<void> {
    await prisma.menuItem.deleteMany({ where: { parentId } });
  }
}