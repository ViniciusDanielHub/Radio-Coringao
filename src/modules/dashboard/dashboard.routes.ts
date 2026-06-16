// src/modules/dashboard/dashboard.routes.ts
import type { FastifyInstance } from 'fastify';
import { dashboardController } from '../../shared/container';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', dashboardController.getStats);
}
