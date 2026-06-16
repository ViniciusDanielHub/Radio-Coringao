// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { CategoryService } from './categories.service';
import { CategoryController } from './categories.controller';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import { CategoryRepository } from './categories.repository';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

const categoryRepo = new CategoryRepository();
const categoryService = new CategoryService(categoryRepo);
const categoryController = new CategoryController(categoryService);

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

export { categoryRepo };