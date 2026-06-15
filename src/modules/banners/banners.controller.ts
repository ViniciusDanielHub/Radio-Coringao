// src/modules/banners/banners.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { BannerService } from './banners.service';

export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  listPublic = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.bannerService.listPublic());
  };

  listAdmin = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.bannerService.listAdmin());
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Imagem é obrigatória.' });
    return reply.code(201).send(await this.bannerService.create(request.uploadedFile.path, request.body as any));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.bannerService.update(id, request.body as any, request.uploadedFile?.path));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.bannerService.delete(id));
  };
}
