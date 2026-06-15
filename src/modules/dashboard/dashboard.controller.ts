// src/modules/dashboard/dashboard.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DashboardService } from './dashboard.service';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  getStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.dashboardService.getStats());
  };
}
