// src/modules/banners/banners.routes.ts
import type { FastifyInstance } from 'fastify';
import { BannerService } from './banners.service';
import { BannerController } from './banners.controller';
import { createBannerSchema, updateBannerSchema } from './banners.schema';
import { BannerRepository } from './banners.repository';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const bannerRepo = new BannerRepository();
const bannerService = new BannerService(bannerRepo);
const bannerController = new BannerController(bannerService);

const uploadBanner = createUploadHandler('banners');

export async function bannerPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listPublic);
}

export async function bannerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listAdmin);

  app.post(
    '/banners',
    { preHandler: [requirePermission('banners:manage'), uploadBanner], schema: createBannerSchema },
    bannerController.create,
  );

  app.patch(
    '/banners/:id',
    { preHandler: [requirePermission('banners:manage'), uploadBanner], schema: updateBannerSchema },
    bannerController.update,
  );

  app.delete(
    '/banners/:id',
    { preHandler: [requirePermission('banners:manage')] },
    bannerController.delete,
  );
}