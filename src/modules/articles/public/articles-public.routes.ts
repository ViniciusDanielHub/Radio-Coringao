// src/modules/articles/public/articles-public.routes.ts
import type { FastifyInstance } from 'fastify';
import { articlePublicController } from '../../../shared/container';

export async function articlePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles',        articlePublicController.list);
  app.get('/articles/search', articlePublicController.search);
  app.get('/articles/:slug',  articlePublicController.getBySlug);
}
