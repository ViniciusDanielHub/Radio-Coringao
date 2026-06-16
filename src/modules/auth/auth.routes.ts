// src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { authController } from '../../shared/container';
import { loginSchema } from './auth.schema';
import { authenticate } from '../../shared/plugins/auth.plugin';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login',   { schema: loginSchema }, authController.login);
  app.post('/refresh', authController.refresh);
  app.post('/logout',  authController.logout);
  app.get('/me',       { preHandler: [authenticate] }, authController.getMe);
}
