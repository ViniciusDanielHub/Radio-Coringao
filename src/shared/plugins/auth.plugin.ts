// src/shared/plugins/auth.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../services/jwt';
import { isTokenBlacklisted } from '../services/token-blacklist';
import { ERROR_MESSAGES } from '../errors';
import { ErrorCode } from '../errors/error-codes';
import type { Role } from '../entities';

let _userRepo: { findById(id: string): Promise<any> } | undefined;

function getUserRepo(): { findById(id: string): Promise<any> } {
  if (!_userRepo) {
    const { UserRepository } = require('../../modules/users/users.repository');
    _userRepo = new UserRepository();
  }
  return _userRepo!;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.code(401).send({
      code: ErrorCode.AUTH_TOKEN_MISSING,
      error: ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_MISSING],
    });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      code: ErrorCode.AUTH_TOKEN_MALFORMED,
      error: ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_MALFORMED],
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token || token.trim() === '') {
    return reply.code(401).send({
      code: ErrorCode.AUTH_TOKEN_MISSING,
      error: 'Token ausente após "Bearer ".',
    });
  }

  let decoded: ReturnType<typeof jwtService.verifyToken>;
  try {
    decoded = jwtService.verifyToken(token);
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send({
        code: ErrorCode.AUTH_TOKEN_EXPIRED,
        error: ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_EXPIRED],
      });
    }
    if (err.name === 'NotBeforeError') {
      return reply.code(401).send({
        code: ErrorCode.AUTH_TOKEN_INVALID,
        error: 'Token ainda não é válido.',
      });
    }
    return reply.code(401).send({
      code: ErrorCode.AUTH_TOKEN_INVALID,
      error: ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_INVALID],
    });
  }

  if (!decoded?.id || !decoded?.role) {
    return reply.code(401).send({
      code: ErrorCode.AUTH_TOKEN_INVALID,
      error: 'Payload do token inválido ou incompleto.',
    });
  }

  // ── Verifica blacklist (tokens revogados por logout/troca de senha) ──
  if (decoded.jti) {
    try {
      const revoked = await isTokenBlacklisted(decoded.jti);
      if (revoked) {
        return reply.code(401).send({
          code: ErrorCode.AUTH_TOKEN_INVALID,
          error: 'Token foi revogado. Faça login novamente.',
        });
      }
    } catch (cacheErr) {
      // Se o cache falhar, logamos mas não bloqueamos o acesso (fail-open)
      // para não derrubar o sistema por falha de cache
      request.log.warn({ err: cacheErr }, 'Falha ao verificar blacklist de token — continuando');
    }
  }

  let user: any;
  try {
    user = await getUserRepo().findById(decoded.id);
  } catch (dbErr: any) {
    request.log.error({ err: dbErr, userId: decoded.id }, 'Erro ao buscar usuário no authenticate');
    return reply.code(503).send({
      code: ErrorCode.DB_CONNECTION_ERROR,
      error: ERROR_MESSAGES[ErrorCode.DB_CONNECTION_ERROR],
    });
  }

  if (!user) {
    return reply.code(401).send({
      code: ErrorCode.AUTH_USER_NOT_FOUND,
      error: ERROR_MESSAGES[ErrorCode.AUTH_USER_NOT_FOUND],
    });
  }

  if (!user.isActive) {
    request.log.warn({ userId: user.id, role: user.role }, 'Tentativa de acesso com conta inativa');
    return reply.code(401).send({
      code: ErrorCode.AUTH_USER_INACTIVE,
      error: ERROR_MESSAGES[ErrorCode.AUTH_USER_INACTIVE],
    });
  }

  request.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };

  // Armazena jti e exp para uso no logout
  request.tokenJti = decoded.jti;
  request.tokenExp = decoded.exp;

  // Armazena o token bruto para repassar a APIs internas que confiam no
  // mesmo JWT_SECRET (ex: clube-api) — ver shared/services/clube-api/http.ts
  request.accessToken = token;
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user?.role) {
      return reply.code(401).send({
        code: ErrorCode.AUTH_TOKEN_MISSING,
        error: 'Autenticação necessária.',
      });
    }
    if (!roles.includes(request.user.role)) {
      request.log.warn(
        { userId: request.user.id, userRole: request.user.role, requiredRoles: roles },
        'Acesso negado — cargo insuficiente',
      );
      return reply.code(403).send({
        code: ErrorCode.PERMISSION_ROLE_INSUFFICIENT,
        error: `Acesso negado. Esta ação requer um dos cargos: ${roles.join(', ')}.`,
        yourRole: request.user.role,
        required: roles,
      });
    }
  };
}