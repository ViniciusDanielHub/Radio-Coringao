// src/modules/articles/use-cases/add-article-image.use-case.ts
import type { IArticleAdminRepository } from '../repositories/article-admin.repository.interface';

export class AddArticleImageUseCase {
  constructor(private readonly repo: IArticleAdminRepository) {}

  async execute(
    articleId: string,
    imageUrl: string,
    body: { alt?: string; caption?: string; credit?: string },
  ) {
    const lastImage = await this.repo.findFirstImage(articleId);
    return this.repo.addImage({
      url:       imageUrl,
      alt:       body.alt,
      caption:   body.caption,
      credit:    body.credit,
      order:     ((lastImage as any)?.order || 0) + 1,
      articleId,
    });
  }
}
