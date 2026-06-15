// src/modules/tags/tags.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TagService } from './tags.service';

export class TagController {
  constructor(private readonly tagService: TagService) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { q } = request.query as { q?: string };
    return reply.send(await this.tagService.list(q));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.tagService.delete(id));
  };
}
