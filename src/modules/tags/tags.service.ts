// src/modules/tags/tags.service.ts
import type { ITagRepository } from './tags.repository';

export class TagService {
  constructor(private readonly repo: ITagRepository) {}

  async list(q?: string) { return this.repo.list(q); }

  async delete(id: string) {
    await this.repo.delete(id);
    return { message: 'Tag deletada.' };
  }
}
