// src/modules/articles/admin/articles-admin.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ArticleAdminService } from './articles-admin.service';

export class ArticleAdminController {
  constructor(private readonly service: ArticleAdminService) { }

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.service.list(request.query as any, request.user.id, request.user.role),
    );
  };

  search = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      await this.service.search(request.query as any, request.user.id, request.user.role),
    );
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.service.getById(id, request.user.id, request.user.role),
    );
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(201).send(
      await this.service.create(
        request.body as any,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.service.update(
        id,
        request.body as any,
        request.user.id,
        request.user.role,
        request.uploadedFile?.path,
      ),
    );
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return reply.send(
      await this.service.updateStatus(id, status, request.user.role),
    );
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.service.delete(id));
  };

  addImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.code(201).send(
      await this.service.addImage(id, request.uploadedFile.path, request.body as any),
    );
  };

  deleteImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, imageId } = request.params as { id: string; imageId: string };
    return reply.send(await this.service.deleteImage(id, imageId));
  };
}