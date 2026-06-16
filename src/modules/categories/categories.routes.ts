// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { categoryController } from '../../shared/container';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

export async function categoryPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listPublic);
}

export async function categoryAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listAdmin);

  app.post(
    '/categories',
    { preHandler: [requirePermission('categories:manage')], schema: createCategorySchema },
    categoryController.create,
  );

  app.patch(
    '/categories/:id',
    { preHandler: [requirePermission('categories:manage')], schema: updateCategorySchema },
    categoryController.update,
  );

  app.delete(
    '/categories/:id',
    { preHandler: [requirePermission('categories:delete')] },
    categoryController.delete,
  );
}
