// src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { loginSchema } from './auth.schema';
import { RefreshTokenRepository } from './auth.repository';
import { UserRepository } from '../users/users.repository';
import { jwtService } from '../../shared/services/jwt';
import { authenticate } from '../../shared/plugins/auth.plugin';

const authService = new AuthService(
  new UserRepository(),
  new RefreshTokenRepository(),
  jwtService,
);

const authController = new AuthController(authService);

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  app.post('/login', { schema: loginSchema }, authController.login);

  // POST /api/auth/refresh
  app.post('/refresh', authController.refresh);

  // POST /api/auth/logout
  app.post('/logout', authController.logout);

  // GET /api/auth/me
  app.get('/me', { preHandler: [authenticate] }, authController.getMe);
}
