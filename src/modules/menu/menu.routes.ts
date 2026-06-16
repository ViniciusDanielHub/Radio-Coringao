// src/modules/menu/menu.routes.ts
import type { FastifyInstance } from 'fastify';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { createMenuItemSchema, updateMenuItemSchema } from './menu.schema';
import { MenuRepository } from './menu.repository';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

const menuRepo = new MenuRepository();
const menuService = new MenuService(menuRepo);
const menuController = new MenuController(menuService);

export async function menuPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getPublic);
}

export async function menuAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/menu', menuController.getAdmin);

  app.post(
    '/menu',
    { preHandler: [requirePermission('menu:manage')], schema: createMenuItemSchema },
    menuController.create,
  );

  app.patch(
    '/menu/:id',
    { preHandler: [requirePermission('menu:manage')], schema: updateMenuItemSchema },
    menuController.update,
  );

  app.delete(
    '/menu/:id',
    { preHandler: [requirePermission('menu:delete')] },
    menuController.delete,
  );
}