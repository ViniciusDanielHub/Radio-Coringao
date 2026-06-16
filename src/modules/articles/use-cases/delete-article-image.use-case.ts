// src/modules/articles/use-cases/delete-article-image.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import { NotFoundError } from '../../../shared/errors';
import { deleteImage } from '../../../shared/services/cloudinary';

export class DeleteArticleImageUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(articleId: string, imageId: string) {
    const image = await this.repo.findImage(imageId, articleId);
    if (!image) throw new NotFoundError('Imagem não encontrada.');
    await deleteImage((image as any).url);
    await this.repo.deleteImage(imageId);
    return { message: 'Imagem deletada.' };
  }
}
