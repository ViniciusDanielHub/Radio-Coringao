// src/modules/auth/auth.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from './auth.service';

export class AuthController {
  constructor(private readonly authService: AuthService) { }

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as { email: string; password: string };
    const result = await this.authService.login(email, password);
    return reply.code(200).send(result);
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    const result = await this.authService.refresh(refreshToken || '');
    return reply.send(result);
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const { refreshToken } = request.body as { refreshToken?: string };

    const jti = request.tokenJti;
    const exp = request.tokenExp;

    // ← passa o userId do token autenticado para gravar lastLogoutAt
    const result = await this.authService.logout(refreshToken, jti, exp, request.user.id);
    return reply.send(result);
  };

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.authService.getMe(request.user.id);
    return reply.send(result);
  };
}