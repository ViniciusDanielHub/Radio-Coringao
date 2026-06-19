// src/modules/presence/presence.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PresenceService } from './presence.service';

export class PresenceController {
  constructor(private readonly service: PresenceService) { }

  /** PATCH /api/admin/presence/heartbeat */
  heartbeat = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.service.heartbeat(request.user.id);
    return reply.send(result);
  };
}