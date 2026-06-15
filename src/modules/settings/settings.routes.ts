// src/modules/settings/settings.routes.ts
import type { FastifyInstance } from 'fastify';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { updateSettingsSchema } from './settings.schema';
import { SiteSettingsRepository } from './settings.repository';
import { authorize } from '../../shared/plugins/auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const settingsRepo = new SiteSettingsRepository();
const settingsService = new SettingsService(settingsRepo);
const settingsController = new SettingsController(settingsService);

const uploadLogo = createUploadHandler('avatars');

/**
 * Public settings endpoints, registered under /api.
 */
export async function settingsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', settingsController.get);
}

/**
 * Admin settings endpoints, registered under /api/admin
 * (authentication is applied via the parent admin router).
 */
export async function settingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/settings', { preHandler: [authorize('ADMIN')], schema: updateSettingsSchema }, settingsController.update);

  app.patch('/settings/logo', { preHandler: [authorize('ADMIN'), uploadLogo] }, settingsController.updateLogo);
}
