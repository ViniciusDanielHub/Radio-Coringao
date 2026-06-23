import type { IEventRepository } from './events.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { deleteImage } from '../../shared/services/cloudinary';
import { createSlug } from '../../shared/services/slugify';

export class EventService {
  constructor(private readonly repo: IEventRepository) { }

  async listPublic() { return this.repo.listPublic(); }
  async listAdmin() { return this.repo.listAdmin(); }

  async getBySlug(slug: string) {
    const event = await this.repo.findBySlug(slug);
    if (!event || !event.isActive) throw new NotFoundError(ErrorCode.EVENT_NOT_FOUND, { slug });
    return event;
  }

  async create(
    data: { title: string; description: string; location?: string; startsAt: string; endsAt?: string },
    coverImageUrl?: string,
  ) {
    if (!data.title?.trim()) throw new ValidationError(ErrorCode.EVENT_TITLE_REQUIRED);
    if (!data.description?.trim()) throw new ValidationError(ErrorCode.EVENT_DESCRIPTION_REQUIRED);
    if (!data.startsAt) throw new ValidationError(ErrorCode.EVENT_DATE_REQUIRED);

    const startsAt = new Date(data.startsAt);
    if (isNaN(startsAt.getTime()))
      throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, { field: 'startsAt' });

    let endsAt: Date | null = null;
    if (data.endsAt) {
      endsAt = new Date(data.endsAt);
      if (isNaN(endsAt.getTime()))
        throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, { field: 'endsAt' });
      if (endsAt <= startsAt) throw new ValidationError(ErrorCode.EVENT_DATE_RANGE_INVALID);
    }

    const slug = await this._uniqueSlug(createSlug(data.title));

    return this.repo.create({
      title: data.title.trim(),
      slug,
      description: data.description.trim(),
      location: data.location?.trim() ?? null,
      startsAt,
      endsAt,
      coverImage: coverImageUrl ?? null,
      isActive: true,
    });
  }

  async update(
    id: string,
    data: { title?: string; description?: string; location?: string; startsAt?: string; endsAt?: string; isActive?: boolean },
    coverImageUrl?: string,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError(ErrorCode.EVENT_NOT_FOUND, { id });

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description.trim();
    if (data.location !== undefined) updateData.location = data.location?.trim() ?? null;
    if (data.isActive !== undefined) updateData.isActive = String(data.isActive) === 'true';

    if (data.startsAt !== undefined) {
      const d = new Date(data.startsAt);
      if (isNaN(d.getTime())) throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, { field: 'startsAt' });
      updateData.startsAt = d;
    }

    if (data.endsAt !== undefined) {
      if (!data.endsAt) {
        updateData.endsAt = null;
      } else {
        const d = new Date(data.endsAt);
        if (isNaN(d.getTime())) throw new ValidationError(ErrorCode.VALIDATION_INVALID_DATE, { field: 'endsAt' });
        if (d <= (updateData.startsAt ?? existing.startsAt)) throw new ValidationError(ErrorCode.EVENT_DATE_RANGE_INVALID);
        updateData.endsAt = d;
      }
    }

    if (coverImageUrl) {
      if (existing.coverImage) await deleteImage(existing.coverImage).catch(() => { });
      updateData.coverImage = coverImageUrl;
    }

    return this.repo.update(id, updateData);
  }

  async delete(id: string) {
    const event = await this.repo.findById(id);
    if (!event) throw new NotFoundError(ErrorCode.EVENT_NOT_FOUND, { id });
    if (event.coverImage) await deleteImage(event.coverImage).catch(() => { });
    for (const img of event.images) await deleteImage(img.url).catch(() => { });
    await this.repo.delete(id);
    return { message: 'Evento deletado.' };
  }

  async addImage(id: string, imageUrl: string, data: { alt?: string; caption?: string; order?: number }) {
    const event = await this.repo.findById(id);
    if (!event) throw new NotFoundError(ErrorCode.EVENT_NOT_FOUND, { id });
    return this.repo.addImage(id, {
      url: imageUrl,
      alt: data.alt ?? null,
      caption: data.caption ?? null,
      order: data.order ? Number(data.order) : event.images.length,
    });
  }

  async deleteImage(eventId: string, imageId: string) {
    const event = await this.repo.findById(eventId);
    if (!event) throw new NotFoundError(ErrorCode.EVENT_NOT_FOUND, { id: eventId });
    const image = event.images.find((i) => i.id === imageId);
    if (!image) throw new NotFoundError(ErrorCode.EVENT_IMAGE_NOT_FOUND, { imageId });
    await deleteImage(image.url).catch(() => { });
    await this.repo.deleteImage(imageId);
    return { message: 'Imagem removida.' };
  }

  private async _uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let counter = 1;
    while (await this.repo.findBySlug(slug)) slug = `${base}-${counter++}`;
    return slug;
  }
}