import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../services/jwt';
import { ERROR_MESSAGES } from '../errors';     
import { ErrorCode } from '../errors/error-codes';
import type { Role } from '../entities';

// Lazy-load do repositório para evitar dependência circular no módulo raiz
let _userRepo: { findById(id: string): Promise<any> } | undefined;

function getUserRepo(): { findById(id: string): Promise<any> } {
  if (!_userRepo) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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

  let decoded: { id: string; role: Role };
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

  let user: any;
  try {
    user = await getUserRepo().findById(decoded.id);
  } catch (dbErr: any) {
    // request.log já carrega o requestId do Fastify — correlação automática
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
    // Log informacional: conta inativa tentando acessar — pode indicar abuso
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