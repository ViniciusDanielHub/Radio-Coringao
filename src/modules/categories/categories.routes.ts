// src/modules/categories/categories.routes.ts
import type { FastifyInstance } from 'fastify';
import { CategoryService } from './categories.service';
import { CategoryController } from './categories.controller';
import { createCategorySchema, updateCategorySchema } from './categories.schema';
import { CategoryRepository } from './categories.repository';
import { authorize } from '../../shared/plugins/auth.plugin';

const categoryRepo = new CategoryRepository();
const categoryService = new CategoryService(categoryRepo);
const categoryController = new CategoryController(categoryService);

/**
 * Public category endpoints, registered under /api.
 */
export async function categoryPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listPublic);
}

/**
 * Admin category endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function categoryAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/categories', categoryController.listAdmin);

  app.post('/categories', { preHandler: [authorize('ADMIN', 'EDITOR')], schema: createCategorySchema }, categoryController.create);

  app.patch('/categories/:id', { preHandler: [authorize('ADMIN', 'EDITOR')], schema: updateCategorySchema }, categoryController.update);

  app.delete('/categories/:id', { preHandler: [authorize('ADMIN')] }, categoryController.delete);
}

// Export the repository for reuse (e.g. dashboard module)
export { categoryRepo };
