// src/modules/articles/category-reports.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CategoryReportsService } from './category-reports.service';

export class CategoryReportsController {
  constructor(private readonly service: CategoryReportsService) { }

  getReports = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getReports());
  };
}