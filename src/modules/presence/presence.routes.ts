import type { FastifyInstance } from 'fastify';
import { PresenceController } from './presence.controller';
import { presenceService } from './presence.service';

const presenceController = new PresenceController(presenceService);

export async function presenceRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/presence/heartbeat', presenceController.heartbeat);
}
