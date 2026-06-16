// src/modules/articles/admin/articles-admin.routes.ts
import type { FastifyInstance } from 'fastify';
import { articleAdminController } from '../../../shared/container';
import { updateArticleStatusSchema } from '../articles.schema';
import { requirePermission } from '../../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../../shared/plugins/upload.plugin';

const uploadArticle = createUploadHandler('articles');

export async function articleAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles',        articleAdminController.list);
  app.get('/articles/search', articleAdminController.search);
  app.get('/articles/:id',    articleAdminController.getById);

  app.post(
    '/articles',
    { preHandler: [requirePermission('articles:create'), uploadArticle] },
    articleAdminController.create,
  );

  app.patch(
    '/articles/:id',
    { preHandler: [requirePermission('articles:edit_own'), uploadArticle] },
    articleAdminController.update,
  );

  app.patch(
    '/articles/:id/status',
    { preHandler: [requirePermission('articles:submit')], schema: updateArticleStatusSchema },
    articleAdminController.updateStatus,
  );

  app.delete(
    '/articles/:id',
    { preHandler: [requirePermission('articles:delete')] },
    articleAdminController.delete,
  );

  app.post(
    '/articles/:id/images',
    { preHandler: [uploadArticle] },
    articleAdminController.addImage,
  );

  app.delete('/articles/:id/images/:imageId', articleAdminController.deleteImage);
}
