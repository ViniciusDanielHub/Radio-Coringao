// src/modules/articles/category-reports.routes.ts
//
// GET /api/admin/dashboard/categories
//
// Retorna, para 3 períodos (mês atual, últimos 6 meses, ano atual):
//   - articlesByCategory: quantos artigos PUBLISHED cada categoria
//     teve no período (baseado em publishedAt).
//   - mostReadByCategory: a matéria mais lida (por leitores únicos)
//     de cada categoria no período.
//
// Protegido pela mesma permissão usada no resto do dashboard
// ('dashboard:view') — qualquer cargo que já vê o dashboard
// principal também vê este relatório.
import type { FastifyInstance } from 'fastify';
import { categoryReportsController } from '../category-reports.controller';
import { requirePermission } from '../../../shared/plugins/permissions.plugin';

export async function categoryReportsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/dashboard/categories',
    { preHandler: [requirePermission('dashboard:view')] },
    categoryReportsController.getReports,
  );
}