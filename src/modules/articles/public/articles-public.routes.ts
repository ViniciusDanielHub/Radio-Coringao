// src/modules/articles/public/articles-public.routes.ts
import type { FastifyInstance } from 'fastify';
import { ArticleRepository } from '../articles.repository';
import { ArticlePublicService } from './articles-public.service';
import { ArticlePublicController } from './articles-public.controller';

const repo = new ArticleRepository();
const service = new ArticlePublicService(repo);
const controller = new ArticlePublicController(service);

export async function articlePublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/articles', controller.list);
  app.get('/articles/search', controller.search);
  app.get('/articles/:slug', controller.getBySlug);
}