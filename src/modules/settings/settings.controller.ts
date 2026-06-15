// src/modules/settings/settings.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { SettingsService } from './settings.service';

export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  get = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.settingsService.get());
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.settingsService.update(request.body as any));
  };

  updateLogo = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.uploadedFile) return reply.code(400).send({ error: 'Nenhuma imagem enviada.' });
    return reply.send(await this.settingsService.updateLogo(request.uploadedFile.path));
  };
}
