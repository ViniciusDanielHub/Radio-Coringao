import type { ISponsorRepository } from './sponsors.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { deleteImage } from '../../shared/services/cloudinary';

export class SponsorService {
  constructor(private readonly repo: ISponsorRepository) { }

  async listPublic() {
    return this.repo.listPublic();
  }

  async listAdmin() {
    return this.repo.listAdmin();
  }

  async create(
    logoUrl: string,
    data: { name: string; websiteUrl?: string; description?: string; order?: number },
  ) {
    if (!data.name?.trim()) throw new ValidationError(ErrorCode.SPONSOR_NAME_REQUIRED);

    const duplicate = await this.repo.findByName(data.name.trim());
    if (duplicate) throw new ValidationError(ErrorCode.SPONSOR_NAME_TAKEN);

    return this.repo.create({
      name: data.name.trim(),
      logoUrl,
      websiteUrl: data.websiteUrl ?? null,
      description: data.description?.trim() ?? null,
      isActive: true,
      order: data.order ? Number(data.order) : 0,
    });
  }

  async update(
    id: string,
    data: { name?: string; websiteUrl?: string; description?: string; isActive?: boolean; order?: number },
    logoUrl?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.SPONSOR_NOT_FOUND, { id });

    const updateData: any = {};

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      const duplicate = await this.repo.findByName(trimmed);
      if (duplicate && duplicate.id !== id) throw new ValidationError(ErrorCode.SPONSOR_NAME_TAKEN);
      updateData.name = trimmed;
    }

    if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl ?? null;
    if (data.description !== undefined) updateData.description = data.description?.trim() ?? null;
    if (data.isActive !== undefined) updateData.isActive = String(data.isActive) === 'true';
    if (data.order !== undefined) updateData.order = Number(data.order);

    if (logoUrl) {
      await deleteImage(existing.logoUrl).catch(() => { });
      updateData.logoUrl = logoUrl;
    }

    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const sponsor = await this.repo.findById(id);
    if (!sponsor) throw new NotFoundError(ErrorCode.SPONSOR_NOT_FOUND, { id });
    await deleteImage(sponsor.logoUrl).catch(() => { });
    await this.repo.delete(id);
    return { message: 'Patrocinador deletado.' };
  }
}