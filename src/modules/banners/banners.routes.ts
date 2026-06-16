// src/modules/banners/banners.routes.ts
import type { FastifyInstance } from 'fastify';
import { bannerController } from '../../shared/container';
import { createBannerSchema, updateBannerSchema } from './banners.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

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
