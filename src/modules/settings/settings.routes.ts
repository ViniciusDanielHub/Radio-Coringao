// src/modules/settings/settings.routes.ts
import type { FastifyInstance } from 'fastify';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { updateSettingsSchema } from './settings.schema';
import { SiteSettingsRepository } from './settings.repository';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const settingsRepo = new SiteSettingsRepository();
const settingsService = new SettingsService(settingsRepo);
const settingsController = new SettingsController(settingsService);

const uploadLogo = createUploadHandler('avatars');

export async function settingsPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/settings', settingsController.get);
}

export async function settingsAdminRoutes(app: FastifyInstance): Promise<void> {
  app.patch(
    '/settings',
    { preHandler: [requirePermission('settings:manage')], schema: updateSettingsSchema },
    settingsController.update,
  );

  app.patch(
    '/settings/logo',
    { preHandler: [requirePermission('settings:manage'), uploadLogo] },
    settingsController.updateLogo,
  );
}