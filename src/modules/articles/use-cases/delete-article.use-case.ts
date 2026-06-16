// src/modules/articles/use-cases/delete-article.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import { NotFoundError } from '../../../shared/errors';
import { deleteImage } from '../../../shared/services/cloudinary';

export class DeleteArticleUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(id: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    if ((article as any).coverImage) await deleteImage((article as any).coverImage);
    for (const img of (article as any).images || []) await deleteImage(img.url);

    await this.repo.delete(id);
    return { message: 'Artigo deletado com sucesso.' };
  }
}
