import type { FastifyInstance } from 'fastify';
import { categoryReportsController } from '../../shared/container';
import { requirePermission } from '../../shared/plugins/permissions.plugin';

export async function categoryReportsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/dashboard/categories',
    { preHandler: [requirePermission('dashboard:view')] },
    categoryReportsController.getReports,
  );
}