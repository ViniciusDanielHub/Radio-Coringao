// src/modules/menu/menu.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MenuService } from './menu.service';

export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  getPublic = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.menuService.getPublic());
  };

  getAdmin = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.menuService.getAdmin());
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(201).send(await this.menuService.create(request.body as any));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.menuService.update(id, request.body as any));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.menuService.delete(id));
  };
}
