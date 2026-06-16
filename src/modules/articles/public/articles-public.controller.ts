// src/modules/articles/public/articles-public.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ArticlePublicService } from './articles-public.service';

export class ArticlePublicController {
  constructor(private readonly service: ArticlePublicService) { }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.list(request.query as any));
  };

  getBySlug = async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    return reply.send(await this.service.getBySlug(slug));
  };

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.search(request.query as any));
  };
}