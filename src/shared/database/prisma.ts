// src/shared/database/prisma.ts
import { PrismaClient } from '@prisma/client';

// ─── Connection pool ──────────────────────────────────────────
// Em produção, o Prisma usa um pool de conexões via connection_limit na URL.
// Aqui também configuramos os timeouts para evitar conexões presas.
//
// Recomendações para produção:
//   connection_limit  = (núcleos × 2) + 1  — regra geral para PostgreSQL
//   pool_timeout      = 10s                 — tempo máximo aguardando conexão livre
//   connect_timeout   = 10s                 — tempo para estabelecer a conexão
//
// Esses valores podem ser sobrescritos via DATABASE_URL:
//   postgresql://user:pass@host/db?connection_limit=10&pool_timeout=10
//
// Referência: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections

function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não configurada');

  // Adiciona parâmetros de pool apenas se ainda não foram definidos na URL
  const parsed = new URL(url);

  if (!parsed.searchParams.has('connection_limit')) {
    // Detecta núcleos disponíveis; mínimo 2, máximo 20 para não sobrecarregar o Postgres
    const cores = Math.min(Math.max((require('os').cpus().length ?? 2) * 2 + 1, 2), 20);
    parsed.searchParams.set('connection_limit', String(cores));
  }

  if (!parsed.searchParams.has('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '10');
  }

  if (!parsed.searchParams.has('connect_timeout')) {
    parsed.searchParams.set('connect_timeout', '10');
  }

  return parsed.toString();
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: buildDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});