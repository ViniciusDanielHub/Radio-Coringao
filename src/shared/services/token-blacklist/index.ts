// src/shared/services/token-blacklist/index.ts
//
// Blacklist de access tokens JWT.
//
// Por que precisamos disso?
//   O refresh token já tem rotação e é revogado no logout/troca de senha.
//   Mas o ACCESS token é stateless — até expirar, continua válido mesmo após logout.
//   Se um access token vazar (ex: log, XSS, man-in-the-middle), o atacante tem
//   acesso até o token expirar (padrão: 7d — muito tempo).
//
// Solução: ao fazer logout ou trocar senha, adicionamos o jti (JWT ID) do
// access token à blacklist com TTL igual ao tempo restante de expiração.
// O middleware de autenticação rejeita tokens cujo jti está na blacklist.
//
// Implementação:
//   - Usa o mesmo ICacheService (in-memory ou Redis) já existente no projeto.
//   - In-memory: funciona em instância única. Em cluster, use Redis.
//   - Redis: funciona em múltiplas instâncias (recomendado para produção).
//
// IMPORTANTE: Para usar o jti, o JwtService precisa incluir o campo `jti`
// no payload ao gerar tokens. Ver atualização em jwt/index.ts.

import { getCache } from '../cache';

const BLACKLIST_PREFIX = 'jti:blacklist:';

/**
 * Adiciona um token à blacklist.
 * @param jti - JWT ID do token a ser revogado
 * @param expiresAt - Timestamp (ms) de expiração do token original
 */
export async function blacklistToken(jti: string, expiresAt: number): Promise<void> {
  const ttlMs = expiresAt - Date.now();
  if (ttlMs <= 0) return; // Já expirou, não precisa blacklistar

  const cache = getCache();
  await cache.set(`${BLACKLIST_PREFIX}${jti}`, true, ttlMs);
}

/**
 * Verifica se um token está na blacklist.
 * @param jti - JWT ID a verificar
 * @returns true se o token foi revogado
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const cache = getCache();
  const result = await cache.get<boolean>(`${BLACKLIST_PREFIX}${jti}`);
  return result === true;
}