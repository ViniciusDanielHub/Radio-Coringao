// src/modules/users/users.routes.ts
import type { FastifyInstance } from 'fastify';
import { userController } from '../../shared/container';
import { createUserSchema, updateUserSchema, changeOwnPasswordSchema, changeUserPasswordSchema } from './users.schema';
import { authorize } from '../../shared/plugins/auth.plugin';
import { createUploadHandler } from '../../shared/plugins/upload.plugin';

const uploadAvatar = createUploadHandler('avatars');

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // ─── Perfil próprio (qualquer usuário logado) ──────────────
  app.patch('/profile/password', { schema: changeOwnPasswordSchema }, userController.changeOwnPassword);
  app.patch('/profile/avatar',   { preHandler: [uploadAvatar] },      userController.updateAvatar);

  // ─── Gestão de usuários (apenas SUPER_ADMIN) ───────────────
  app.get('/users',              { preHandler: [authorize('SUPER_ADMIN')] },                               userController.list);
  app.get('/users/:id',          { preHandler: [authorize('SUPER_ADMIN')] },                               userController.getById);
  app.post('/users',             { preHandler: [authorize('SUPER_ADMIN')], schema: createUserSchema },     userController.create);
  app.patch('/users/:id',        { preHandler: [authorize('SUPER_ADMIN')], schema: updateUserSchema },     userController.update);
  app.patch('/users/:id/password', { preHandler: [authorize('SUPER_ADMIN')], schema: changeUserPasswordSchema }, userController.changeUserPassword);
  app.delete('/users/:id',       { preHandler: [authorize('SUPER_ADMIN')] },                               userController.deactivate);
}
