// src/shared/services/visitor/index.ts
//
// Captura do "visitante" sem cadastro de usuários.
//
// Por que hash e não o IP puro?
//   - LGPD trata IP como dado pessoal. Hasheamos (SHA-256 + salt fixo da app)
//     para nunca persistir o IP em texto puro, mas ainda conseguir comparar
//     "é o mesmo visitante" para deduplicar leituras.
//   - O salt vem de JWT_SECRET (já existe no .env) só para não precisar
//     de mais uma variável de ambiente.
//
// Por que pegar de request.headers e não só request.ip?
//   - Em produção, a API geralmente roda atrás de proxy/load balancer
//     (Railway, Render, Nginx, Cloudflare). O socket.remoteAddress nesses
//     casos é o IP do proxy, não do visitante real.
//   - X-Forwarded-For é o padrão de fato para isso. Pegamos o PRIMEIRO IP
//     da lista (o mais à esquerda = o cliente original).
//   - Fallback para request.ip cobre o caso de dev local sem proxy.

import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';

const SALT = process.env.JWT_SECRET || 'sports-news-fallback-salt';

/**
 * Extrai o IP "mais real possível" do request, considerando proxies comuns.
 */
export function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    // Pode vir como "ip1, ip2, ip3" — o primeiro é o cliente original
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim() !== '') {
    return realIp.trim();
  }

  return request.ip;
}

/**
 * Gera um hash determinístico do IP — mesmo IP sempre gera o mesmo hash,
 * mas o hash não pode ser revertido para o IP original sem o salt.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${ip}:${SALT}`).digest('hex');
}

/**
 * Atalho: extrai e já retorna o hash, pronto para salvar no banco.
 */
export function getVisitorHash(request: FastifyRequest): string {
  return hashIp(getClientIp(request));
}