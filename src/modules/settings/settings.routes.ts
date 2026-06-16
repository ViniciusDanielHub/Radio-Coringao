// src/modules/settings/settings.routes.ts
import type { FastifyInstance } from 'fastify';
import { settingsController } from '../../shared/container';
import { updateSettingsSchema } from './settings.schema';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

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
