// src/modules/banners/banners.routes.ts
import type { FastifyInstance } from 'fastify';
import { BannerService } from './banners.service';
import { BannerController } from './banners.controller';
import { createBannerSchema, updateBannerSchema } from './banners.schema';
import { BannerRepository } from './banners.repository';
import { authorize } from '../../shared/plugins/auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const bannerRepo = new BannerRepository();
const bannerService = new BannerService(bannerRepo);
const bannerController = new BannerController(bannerService);

const uploadBanner = createUploadHandler('banners');

/**
 * Public banner endpoints, registered under /api.
 */
export async function bannerPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listPublic);
}

/**
 * Admin banner endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function bannerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/banners', bannerController.listAdmin);

  app.post('/banners', { preHandler: [authorize('ADMIN', 'EDITOR'), uploadBanner], schema: createBannerSchema }, bannerController.create);

  app.patch('/banners/:id', { preHandler: [authorize('ADMIN', 'EDITOR'), uploadBanner], schema: updateBannerSchema }, bannerController.update);

  app.delete('/banners/:id', { preHandler: [authorize('ADMIN', 'EDITOR')] }, bannerController.delete);
}
