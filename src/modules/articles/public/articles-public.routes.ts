// src/modules/articles/public/articles-public.routes.ts
import type { FastifyInstance } from 'fastify';
import { articlePublicController } from '../../../shared/container';
import { trendingQuerySchema } from '../articles.schema';

export async function articlePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles', articlePublicController.list);
  app.get('/articles/search', articlePublicController.search);
  app.get('/articles/trending', { schema: trendingQuerySchema }, articlePublicController.trending);
  // :slug deve ficar por último para não capturar as rotas estáticas acima
  app.get('/articles/:slug', articlePublicController.getBySlug);
}