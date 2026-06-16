// src/modules/menu/menu.routes.ts
import type { FastifyInstance } from 'fastify';
import { menuController } from '../../shared/container';
import { createMenuItemSchema, updateMenuItemSchema } from './menu.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

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
