// src/modules/users/users.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserService } from './users.service';

export class UserController {
  constructor(private readonly userService: UserService) { }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = 1, limit = 20, role, isActive } = request.query as any;
    return reply.send(await this.userService.list(
      { role, isActive: isActive !== undefined ? isActive === 'true' : undefined },
      { page: Number(page), limit: Number(limit) },
    ));
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.userService.getById(id));
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as any;
    // passa o role de quem está fazendo a requisição
    return reply.code(201).send(await this.userService.create(data, request.user.role));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.userService.update(id, request.body as any, request.user.role));
  };

  changeUserPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { newPassword } = request.body as any;
    return reply.send(await this.userService.changeUserPassword(id, newPassword));
  };

  deactivate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.userService.deactivate(id, request.user.id, request.user.role));
  };

  changeOwnPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { currentPassword, newPassword } = request.body as any;
    return reply.send(await this.userService.changeOwnPassword(request.user.id, currentPassword, newPassword));
  };

  updateAvatar = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.send(await this.userService.updateAvatar(request.user.id, request.uploadedFile.path));
  };
}