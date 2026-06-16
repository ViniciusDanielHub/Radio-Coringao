// src/modules/banners/banners.service.ts
import type { IBannerRepository } from './banners.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { deleteImage } from '../../shared/services/cloudinary';

export class BannerService {
  constructor(private readonly repo: IBannerRepository) { }

  async listPublic() { return this.repo.listPublic(); }
  async listAdmin() { return this.repo.listAdmin(); }

  async create(
    imageUrl: string,
    data: {
      title: string;
      linkUrl?: string;
      order?: number;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    if (!data.title || data.title.trim() === '') {
      throw new ValidationError(ErrorCode.BANNER_TITLE_REQUIRED);
    }

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;

    if (data.startsAt) {
      startsAt = new Date(data.startsAt);
      if (isNaN(startsAt.getTime())) {
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
          field: 'startsAt',
          value: data.startsAt,
        });
      }
    }

    if (data.endsAt) {
      endsAt = new Date(data.endsAt);
      if (isNaN(endsAt.getTime())) {
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
          field: 'endsAt',
          value: data.endsAt,
        });
      }
    }

    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new ValidationError(ErrorCode.BANNER_DATE_RANGE_INVALID, {
        startsAt: data.startsAt,
        endsAt: data.endsAt,
      });
    }

    return this.repo.create({
      title: data.title.trim(),
      imageUrl,
      linkUrl: data.linkUrl ?? null,
      isActive: true,
      order: data.order ? Number(data.order) : 0,
      startsAt,
      endsAt,
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      linkUrl?: string;
      order?: number;
      isActive?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
    imageUrl?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.BANNER_NOT_FOUND, { id });

    let startsAt: Date | null | undefined = undefined;
    let endsAt: Date | null | undefined = undefined;

    if (data.startsAt !== undefined) {
      startsAt = data.startsAt ? new Date(data.startsAt) : null;
      if (startsAt && isNaN(startsAt.getTime())) {
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
          field: 'startsAt',
          value: data.startsAt,
        });
      }
    }

    if (data.endsAt !== undefined) {
      endsAt = data.endsAt ? new Date(data.endsAt) : null;
      if (endsAt && isNaN(endsAt.getTime())) {
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, {
          field: 'endsAt',
          value: data.endsAt,
        });
      }
    }

    // Valida intervalo usando os valores resolvidos (ou os existentes)
    const resolvedStarts = startsAt !== undefined ? startsAt : existing.startsAt;
    const resolvedEnds = endsAt !== undefined ? endsAt : existing.endsAt;
    if (resolvedStarts && resolvedEnds && resolvedStarts >= resolvedEnds) {
      throw new ValidationError(ErrorCode.BANNER_DATE_RANGE_INVALID, {
        startsAt: resolvedStarts,
        endsAt: resolvedEnds,
      });
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.linkUrl !== undefined) updateData.linkUrl = data.linkUrl ?? null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = Number(data.order);
    if (startsAt !== undefined) updateData.startsAt = startsAt;
    if (endsAt !== undefined) updateData.endsAt = endsAt;

    if (imageUrl) {
      await deleteImage(existing.imageUrl).catch(() => { });
      updateData.imageUrl = imageUrl;
    }

    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const banner = await this.repo.findById(id);
    if (!banner) throw new NotFoundError(ErrorCode.BANNER_NOT_FOUND, { id });

    await deleteImage(banner.imageUrl).catch(() => { });
    await this.repo.delete(id);
    return { message: 'Banner deletado.' };
  }
}