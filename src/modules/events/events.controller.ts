import type { FastifyRequest, FastifyReply } from 'fastify';
import type { EventService } from './events.service';

export class EventController {
  constructor(private readonly eventService: EventService) { }

  listPublic = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.send(await this.eventService.listPublic());

  listAdmin = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.send(await this.eventService.listAdmin());

  getBySlug = async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = request.params as { slug: string };
    return reply.send(await this.eventService.getBySlug(slug));
  };

  create = async (request: FastifyRequest, reply: FastifyReply) =>
    reply.code(201).send(await this.eventService.create(request.body as any, request.uploadedFile?.path));

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.eventService.update(id, request.body as any, request.uploadedFile?.path));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    return reply.send(await this.eventService.delete(id));
  };

  addImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Imagem é obrigatória.' });
    return reply.code(201).send(await this.eventService.addImage(id, request.uploadedFile.path, request.body as any));
  };

  deleteImage = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, imageId } = request.params as { id: string; imageId: string };
    return reply.send(await this.eventService.deleteImage(id, imageId));
  };
}