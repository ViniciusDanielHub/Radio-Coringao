// src/shared/plugins/permissions.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '../entities';

export type Permission =
  // Usuários
  | 'users:manage'

  // Artigos
  | 'articles:create'
  | 'articles:edit_own'
  | 'articles:edit_any'
  | 'articles:submit'
  | 'articles:publish'
  | 'articles:archive'
  | 'articles:delete'

  // Categorias
  | 'categories:manage'
  | 'categories:delete'

  // Tags
  | 'tags:delete'

  // Banners
  | 'banners:manage'

  // Menu
  | 'menu:manage'
  | 'menu:delete'

  // Configurações
  | 'settings:manage'

  // Dashboard
  | 'dashboard:view';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'users:manage',
    'articles:create', 'articles:edit_own', 'articles:edit_any',
    'articles:submit', 'articles:publish', 'articles:archive', 'articles:delete',
    'categories:manage', 'categories:delete',
    'tags:delete',
    'banners:manage',
    'menu:manage', 'menu:delete',
    'settings:manage',
    'dashboard:view',
  ],

  EDITOR_CHEFE: [
    'articles:create', 'articles:edit_own', 'articles:edit_any',
    'articles:submit', 'articles:publish', 'articles:archive', 'articles:delete',
    'categories:manage', 'categories:delete',
    'tags:delete',
    'banners:manage',
    'menu:manage', 'menu:delete',
    'settings:manage',
    'dashboard:view',
  ],

  EDITOR: [
    'articles:create', 'articles:edit_own', 'articles:edit_any',
    'articles:submit', 'articles:publish', 'articles:archive', 'articles:delete',
    'categories:manage',
    'tags:delete',
    'banners:manage',
    'menu:manage',
    'dashboard:view',
  ],

  JORNALISTA: [
    'articles:create',
    'articles:edit_own',
    'articles:submit',
    'dashboard:view',
  ],

  COLUNISTA: [
    'articles:create',
    'articles:edit_own',
    'articles:submit',
    'dashboard:view',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

  export function requirePermission(permission: Permission) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const role = request.user?.role;
      if (!role || !hasPermission(role, permission)) {
        reply.code(403).send({
          error: 'Acesso negado. Você não tem permissão para esta ação.',
          required: permission,
          yourRole: role ?? 'unknown',
        });
      }
    };
  }

  export function authorize(...roles: Role[]) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!roles.includes(request.user?.role)) {
        reply.code(403).send({ error: 'Acesso negado. Você não tem permissão para esta ação.' });
      }
    };
}

export const CAN_PUBLISH_ROLES: Role[] = ['SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR'];
export const CAN_EDIT_ANY_ROLES: Role[] = ['SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR'];
export const OWN_ARTICLES_ONLY_ROLES: Role[] = ['JORNALISTA', 'COLUNISTA'];