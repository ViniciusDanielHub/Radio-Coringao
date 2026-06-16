// src/shared/plugins/auth-rate-limit.plugin.ts
//
// Rate limiter específico para rotas de autenticação.
// O rate limit global (300 req / 15 min) é insuficiente para proteger
// contra brute force de senhas — um atacante pode tentar ~20 senhas/min
// sem acionar o limite global. Este plugin aplica um limite muito mais
// agressivo apenas nas rotas de auth.
//
// Janela:  15 minutos
// Máximo:  10 tentativas por IP (< 1 tentativa/min em média)
// Penalidade: após exceder, 429 com cabeçalho Retry-After
//
// NOTA: em produção com múltiplas instâncias, use um store Redis
// (ex: @fastify/rate-limit + ioredis) para compartilhar contadores.
// Com uma única instância (Docker Compose, Railway, Render) o store
// in-memory padrão já é suficiente.

import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerAuthRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    // Prefixo para não colidir com o store do rate-limit global
    nameSpace: 'auth-',
    max: 10,
    timeWindow: '15 minutes',
    // Agrupa por IP. Em produção atrás de proxy, garanta que
    // `trustProxy: true` está configurado no Fastify para que
    // request.ip reflita o IP real (X-Forwarded-For).
    keyGenerator: (request) => `auth:${request.ip}`,
    errorResponseBuilder: (request, context) => ({
      code: 'RATE_LIMIT_EXCEEDED',
      error: 'Muitas tentativas de login. Aguarde 15 minutos antes de tentar novamente.',
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
    // Adiciona cabeçalho Retry-After conforme RFC 6585
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
}