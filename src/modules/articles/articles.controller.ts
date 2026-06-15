// src/modules/articles/articles.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ArticleService } from './articles.service';

export class ArticleController {
  constructor(private readonly articleService: ArticleService) {}

  // ─── Public ───────────────────────────────────────────────
  listPublic = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.articleService.listPublic(request.query as any));
  };

  getPublicBySlug = async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    return reply.send(await this.articleService.getPublicBySlug(slug));
  };

  // ─── Admin ────────────────────────────────────────────────
  listAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.articleService.listAdmin(request.query as any, request.user.id, request.user.role));
  };

  getAdminById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.articleService.getAdminById(id, request.user.id, request.user.role));
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = request.body as any;
    return reply.code(201).send(
      await this.articleService.create(data, request.user.id, request.user.role, request.uploadedFile?.path),
    );
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.articleService.update(id, request.body as any, request.user.id, request.user.role, request.uploadedFile?.path),
    );
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as any;
    return reply.send(await this.articleService.updateStatus(id, status, request.user.role));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.articleService.delete(id));
  };

  addImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.code(201).send(await this.articleService.addImage(id, request.uploadedFile.path, request.body as any));
  };

  deleteImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, imageId } = request.params as { id: string; imageId: string };
    return reply.send(await this.articleService.deleteImage(id, imageId));
  };
}
