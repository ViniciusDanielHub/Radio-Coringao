import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';
import { NotFoundError } from '../../../shared/errors';
import { deleteImageSafe } from '../../../shared/services/cloudinary';
import { logger as rootLogger, type Logger } from '../../../shared/logger';

export class DeleteArticleUseCase {
  private readonly log: Logger;

  constructor(
    private readonly repo: IArticleAdminRepository,
    log?: Logger,
  ) {
    this.log = log ?? rootLogger.child({ useCase: 'DeleteArticle' });
  }

  async execute(id: string) {
    const article = await this.repo.findById(id);
    if (!article) throw new NotFoundError('Artigo não encontrado.');

    // Deleta imagens de forma segura: o registro é removido mesmo se o Cloudinary falhar
    if ((article as any).coverImage) {
      await deleteImageSafe((article as any).coverImage, { articleId: id, field: 'coverImage' });
    }

    for (const img of (article as any).images ?? []) {
      await deleteImageSafe(img.url, { articleId: id, imageId: img.id });
    }

    await this.repo.delete(id);

    this.log.info({ articleId: id }, 'Artigo deletado');

    return { message: 'Artigo deletado com sucesso.' };
  }
}