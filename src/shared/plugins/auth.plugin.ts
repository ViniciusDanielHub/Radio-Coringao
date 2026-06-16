// src/shared/plugins/auth.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../services/jwt';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { ErrorCode } from '../errors/error-codes';
import type { Role } from '../entities';

let _userRepo: { findById(id: string): Promise<any> } | null = null;

function getUserRepo() {
  if (!_userRepo) {
    const { UserRepository } = require('../../modules/users/users.repository');
    _userRepo = new UserRepository();
  }
  return _userRepo;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.code(401).send({
      code:  ErrorCode.AUTH_TOKEN_MISSING,
      error: 'Token de autenticação não fornecido. Inclua o header: Authorization: Bearer <token>',
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      code:  ErrorCode.AUTH_TOKEN_MALFORMED,
      error: 'Formato de token inválido. Use: Authorization: Bearer <token>',
    });
  }

  try {
    const token   = authHeader.split(' ')[1];
    const decoded = jwtService.verifyToken(token);

    const user = await getUserRepo().findById(decoded.id);
    if (!user) {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_USER_NOT_FOUND,
        error: 'Usuário associado ao token não encontrado. Faça login novamente.',
      });
    }
    if (!user.isActive) {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_USER_INACTIVE,
        error: 'Esta conta foi desativada. Entre em contato com o administrador.',
      });
    }

    request.user = {
      id:       user.id,
      name:     user.name,
      email:    user.email,
      role:     user.role,
      isActive: user.isActive,
    };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_TOKEN_EXPIRED,
        error: 'Seu token expirou. Faça login novamente ou use o endpoint /api/auth/refresh.',
      });
    }
    return reply.code(401).send({
      code:  ErrorCode.AUTH_TOKEN_INVALID,
      error: 'Token de autenticação inválido ou corrompido.',
    });
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user?.role) {
      return reply.code(401).send({
        code:  ErrorCode.AUTH_TOKEN_MISSING,
        error: 'Autenticação necessária.',
      });
    }
    if (!roles.includes(request.user.role)) {
      return reply.code(403).send({
        code:      ErrorCode.PERMISSION_ROLE_INSUFFICIENT,
        error:     `Acesso negado. Esta ação requer um dos cargos: ${roles.join(', ')}.`,
        yourRole:  request.user.role,
        required:  roles,
      });
    }
  };
}
