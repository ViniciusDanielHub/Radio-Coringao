// src/shared/plugins/auth.plugin.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from '../services/jwt';
import { UserRepository } from '../../modules/users/users.repository';
import type { Role } from '../entities';

const userRepo = new UserRepository();

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Token de autenticação não fornecido.' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwtService.verifyToken(token);

    const user = await userRepo.findById(decoded.id);
    if (!user || !user.isActive) {
      reply.code(401).send({ error: 'Usuário não encontrado ou desativado.' });
      return;
    }

    request.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      reply.code(401).send({ error: 'Token expirado. Faça login novamente.' });
    } else {
      reply.code(401).send({ error: 'Token inválido.' });
    }
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user?.role)) {
      reply.code(403).send({ error: 'Acesso negado. Você não tem permissão para esta ação.' });
    }
  };
}
