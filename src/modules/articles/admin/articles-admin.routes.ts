// src/modules/articles/admin/articles-admin.routes.ts
import type { FastifyInstance } from 'fastify';
import { ArticleRepository } from '../articles.repository';
import { ArticleAdminService } from './articles-admin.service';
import { ArticleAdminController } from './articles-admin.controller';
import { updateArticleStatusSchema } from '../articles.schema';
import { requirePermission } from '../../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../../shared/plugins/upload.plugin';

const repo = new ArticleRepository();
const service = new ArticleAdminService(repo);
const controller = new ArticleAdminController(service);

const uploadArticle = createUploadHandler('articles');

export async function articleAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles', controller.list);
  app.get('/articles/search', controller.search);
  app.get('/articles/:id', controller.getById);

  app.post(
    '/articles',
    { preHandler: [requirePermission('articles:create'), uploadArticle] },
    controller.create,
  );

  app.patch(
    '/articles/:id',
    { preHandler: [requirePermission('articles:edit_own'), uploadArticle] },
    controller.update,
  );

  app.patch(
    '/articles/:id/status',
    { preHandler: [requirePermission('articles:submit')], schema: updateArticleStatusSchema },
    controller.updateStatus,
  );

  app.delete(
    '/articles/:id',
    { preHandler: [requirePermission('articles:delete')] },
    controller.delete,
  );

  app.post(
    '/articles/:id/images',
    { preHandler: [uploadArticle] },
    controller.addImage,
  );

  app.delete('/articles/:id/images/:imageId', controller.deleteImage);
}