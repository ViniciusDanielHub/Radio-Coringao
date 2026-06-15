// src/modules/articles/articles.routes.ts
import type { FastifyInstance } from 'fastify';
import { ArticleService } from './articles.service';
import { ArticleController } from './articles.controller';
import { updateArticleStatusSchema } from './articles.schema';
import { ArticleRepository } from './articles.repository';
import { authorize } from '../../shared/plugins/auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const articleRepo = new ArticleRepository();
const articleService = new ArticleService(articleRepo);
const articleController = new ArticleController(articleService);

const uploadArticle = createUploadHandler('articles');

/**
 * Public article endpoints, registered under /api.
 */
export async function articlePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles', articleController.listPublic);
  app.get('/articles/:slug', articleController.getPublicBySlug);
}

/**
 * Admin article endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function articleAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles', articleController.listAdmin);

  app.get('/articles/:id', articleController.getAdminById);

  app.post('/articles', { preHandler: [uploadArticle] }, articleController.create);

  app.patch('/articles/:id', { preHandler: [uploadArticle] }, articleController.update);

  app.patch('/articles/:id/status', { preHandler: [authorize('ADMIN', 'EDITOR')], schema: updateArticleStatusSchema }, articleController.updateStatus);

  app.delete('/articles/:id', { preHandler: [authorize('ADMIN', 'EDITOR')] }, articleController.delete);

  app.post('/articles/:id/images', { preHandler: [uploadArticle] }, articleController.addImage);

  app.delete('/articles/:id/images/:imageId', articleController.deleteImage);
}

// Export the repository for reuse (e.g. dashboard module)
export { articleRepo };
