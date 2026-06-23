import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SponsorService } from './sponsors.service';

export class SponsorController {
  constructor(private readonly sponsorService: SponsorService) { }

  listPublic = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.sponsorService.listPublic());
  };

  listAdmin = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.sponsorService.listAdmin());
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Logo é obrigatória.' });
    return reply.code(201).send(
      await this.sponsorService.create(request.uploadedFile.path, request.body as any),
    );
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(
      await this.sponsorService.update(id, request.body as any, request.uploadedFile?.path),
    );
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.sponsorService.delete(id));
  };
}