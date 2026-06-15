// src/modules/dashboard/dashboard.routes.ts
import type { FastifyInstance } from 'fastify';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ArticleRepository } from '../articles/articles.repository';
import { UserRepository } from '../users/users.repository';
import { CategoryRepository } from '../categories/categories.repository';

const dashboardService = new DashboardService(
  new ArticleRepository(),
  new UserRepository(),
  new CategoryRepository(),
);

const dashboardController = new DashboardController(dashboardService);

/**
 * Admin dashboard endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', dashboardController.getStats);
}
