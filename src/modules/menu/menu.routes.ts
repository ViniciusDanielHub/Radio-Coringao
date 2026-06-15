// src/modules/menu/menu.routes.ts
import type { FastifyInstance } from 'fastify';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { createMenuItemSchema, updateMenuItemSchema } from './menu.schema';
import { MenuRepository } from './menu.repository';
import { authorize } from '../../shared/plugins/auth.plugin';

const menuRepo = new MenuRepository();
const menuService = new MenuService(menuRepo);
const menuController = new MenuController(menuService);

/**
 * Public menu endpoints, registered under /api.
 */
export async function menuPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getPublic);
}

/**
 * Admin menu endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function menuAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getAdmin);

  app.post('/menu', { preHandler: [authorize('ADMIN', 'EDITOR')], schema: createMenuItemSchema }, menuController.create);

  app.patch('/menu/:id', { preHandler: [authorize('ADMIN', 'EDITOR')], schema: updateMenuItemSchema }, menuController.update);

  app.delete('/menu/:id', { preHandler: [authorize('ADMIN')] }, menuController.delete);
}
