// src/modules/banners/banners.service.ts
import type { IBannerRepository } from './banners.repository';
import { NotFoundError } from '../../shared/errors';
import { deleteImage } from '../../shared/services/cloudinary';

export class BannerService {
  constructor(private readonly repo: IBannerRepository) {}

  async listPublic() { return this.repo.listPublic(); }
  async listAdmin() { return this.repo.listAdmin(); }

  async create(imageUrl: string, data: { title: string; linkUrl?: string; order?: number; startsAt?: string; endsAt?: string }) {
    return this.repo.create({
      title: data.title,
      imageUrl,
      linkUrl: data.linkUrl,
      isActive: true,
      order: data.order ? Number(data.order) : 0,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
    });
  }

  async update(id: string, data: { title?: string; linkUrl?: string; order?: number; isActive?: boolean; startsAt?: string; endsAt?: string }, imageUrl?: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError('Banner não encontrado.');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = Number(data.order);
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.endsAt !== undefined) updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;

    if (imageUrl) {
      await deleteImage(existing.imageUrl);
      updateData.imageUrl = imageUrl;
    }

    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const banner = await this.repo.findById(id);
    if (!banner) throw new NotFoundError('Banner não encontrado.');
    await deleteImage(banner.imageUrl);
    await this.repo.delete(id);
    return { message: 'Banner deletado.' };
  }
}
