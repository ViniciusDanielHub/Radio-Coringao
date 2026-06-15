// src/modules/categories/categories.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CategoryService } from './categories.service';

export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  listPublic = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.categoryService.listPublic());
  };

  listAdmin = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.categoryService.listAdmin());
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(201).send(await this.categoryService.create(request.body as any));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.categoryService.update(id, request.body as any));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.categoryService.delete(id));
  };
}
