// src/modules/tags/tags.routes.ts
import type { FastifyInstance } from 'fastify';
import { TagService } from './tags.service';
import { TagController } from './tags.controller';
import { listTagsSchema } from './tags.schema';
import { TagRepository } from './tags.repository';
import { authorize } from '../../shared/plugins/auth.plugin';

const tagRepo = new TagRepository();
const tagService = new TagService(tagRepo);
const tagController = new TagController(tagService);

/**
 * Public tag endpoints, registered under /api.
 */
export async function tagPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/tags', { schema: listTagsSchema }, tagController.list);
}

/**
 * Admin tag endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function tagAdminRoutes(app: FastifyInstance): Promise<void> {
  app.delete('/tags/:id', { preHandler: [authorize('ADMIN', 'EDITOR')] }, tagController.delete);
}
