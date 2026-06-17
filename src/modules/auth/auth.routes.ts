// src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { authController } from '../../shared/container';
import { loginSchema } from './auth.schema';
import { authenticate } from '../../shared/plugins/auth.plugin';
import { registerAuthRateLimit } from '../../shared/plugins/auth-rate-limit.plugin';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  await registerAuthRateLimit(app);

  app.post('/login', { schema: loginSchema }, authController.login);
  app.post('/refresh', authController.refresh);

  // Logout requer autenticação para extrair o jti do access token
  // e adicioná-lo à blacklist
  app.post('/logout', { preHandler: [authenticate] }, authController.logout);

  app.get('/me', { preHandler: [authenticate] }, authController.getMe);
}