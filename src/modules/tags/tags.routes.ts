// src/modules/tags/tags.routes.ts
import type { FastifyInstance } from 'fastify';
import { tagController } from '../../shared/container';
import { listTagsSchema } from './tags.schema';
import { authorize } from '../../shared/plugins/auth.plugin';

export async function tagPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tags', { schema: listTagsSchema }, tagController.list);
}

export async function tagAdminRoutes(app: FastifyInstance): Promise<void> {
  app.delete('/tags/:id', { preHandler: [authorize('SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR')] }, tagController.delete);
}
