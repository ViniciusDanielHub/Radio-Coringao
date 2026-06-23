// src/shared/plugins/permissions.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ErrorCode } from '../errors/error-codes';
import type { Role } from '../entities';

export type Permission =
  | 'users:manage'
  | 'articles:create'
  | 'articles:edit_own'
  | 'articles:edit_any'
  | 'articles:submit'
  | 'articles:publish'
  | 'articles:archive'
  | 'articles:delete'
  | 'categories:manage'
  | 'categories:delete'
  | 'tags:delete'
  | 'banners:manage'
  | 'menu:manage'
  | 'menu:delete'
  | 'settings:manage'
  | 'dashboard:view'
  | 'sponsors:manage'
  | 'events:manage'
  | 'biography:manage';

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
    'sponsors:manage',
    'events:manage',
    'biography:manage',
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
    'sponsors:manage',
    'events:manage',
    'biography:manage',
  ],
  EDITOR: [
    'articles:create', 'articles:edit_own', 'articles:edit_any',
    'articles:submit', 'articles:publish', 'articles:archive', 'articles:delete',
    'categories:manage',
    'tags:delete',
    'banners:manage',
    'menu:manage',
    'dashboard:view',
    'events:manage',
    'biography:manage',
  ],
  JORNALISTA:   ['articles:create', 'articles:edit_own', 'articles:submit', 'dashboard:view'],
  COLUNISTA:    ['articles:create', 'articles:edit_own', 'articles:submit', 'dashboard:view'],
  SOCIAL_MEDIA: ['articles:create', 'articles:edit_own', 'articles:submit', 'banners:manage', 'dashboard:view'],
  MODERADOR:    ['articles:edit_any', 'articles:archive', 'tags:delete', 'dashboard:view'],
  SEO_MANAGER:  ['articles:edit_any', 'categories:manage', 'tags:delete', 'dashboard:view'],
};

export const CAN_PUBLISH_ROLES: Role[] = ['SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR'];
export const CAN_EDIT_ANY_ROLES: Role[] = ['SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR', 'MODERADOR', 'SEO_MANAGER'];
export const OWN_ARTICLES_ONLY_ROLES: Role[] = ['JORNALISTA', 'COLUNISTA', 'SOCIAL_MEDIA'];

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const role = request.user?.role;

    if (!role) {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_TOKEN_MISSING,
        error: 'Autenticação necessária para esta ação.',
      });
    }

    if (!hasPermission(role, permission)) {
      return reply.code(403).send({
        code:       ErrorCode.PERMISSION_DENIED,
        error:      `Seu cargo (${role}) não tem permissão para esta operação.`,
        required:   permission,
        yourRole:   role,
        hint:       `Permissão necessária: "${permission}"`,
      });
    }
  };
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const role = request.user?.role;
    if (!role) {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_TOKEN_MISSING,
        error: 'Autenticação necessária.',
      });
    }
    if (!roles.includes(role)) {
      return reply.code(403).send({
        code:     ErrorCode.PERMISSION_ROLE_INSUFFICIENT,
        error:    `Acesso restrito. Cargos permitidos: ${roles.join(', ')}.`,
        yourRole: role,
        required: roles,
      });
    }
  };
}
