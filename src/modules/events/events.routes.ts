import type { FastifyInstance } from 'fastify';
import { eventController } from '../../shared/container';
import { requirePermission } from '../../shared/plugins/permissions.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const uploadEvent = createUploadHandler('events');

export async function eventPublicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', eventController.listPublic);
  app.get('/events/:slug', eventController.getBySlug);
}

export async function eventAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', eventController.listAdmin);

  app.post('/events',
    { preHandler: [requirePermission('events:manage'), uploadEvent] },
    eventController.create,
  );

  app.patch('/events/:id',
    { preHandler: [requirePermission('events:manage'), uploadEvent] },
    eventController.update,
  );

  app.delete('/events/:id',
    { preHandler: [requirePermission('events:manage')] },
    eventController.delete,
  );

  app.post('/events/:id/images',
    { preHandler: [requirePermission('events:manage'), uploadEvent] },
    eventController.addImage,
  );

  app.delete('/events/:id/images/:imageId',
    { preHandler: [requirePermission('events:manage')] },
    eventController.deleteImage,
  );
}