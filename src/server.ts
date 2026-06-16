// src/server.ts
import 'dotenv/config';
import { checkEnv } from './shared/env-check';
import { buildApp } from './app';
import { logger } from './shared/logger';
import { startScheduler, stopScheduler } from './shared/workers/scheduler.worker';
import { initSentry, flushSentry } from './shared/monitoring/sentry';
import { getCache } from './shared/services/cache';

// Valida variáveis de ambiente antes de iniciar
checkEnv();

// Inicializa Sentry o mais cedo possível para capturar erros de bootstrap
// (no-op se SENTRY_DSN não estiver configurado)
initSentry();

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const app = await buildApp();

  // Aquece o cache (conecta ao Redis se configurado)
  getCache();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    logger.info(
      { port: PORT, env: process.env.NODE_ENV ?? 'development', health: `http://localhost:${PORT}/api/health` },
      'Servidor iniciado',
    );
  } catch (err) {
    logger.error({ err }, 'Falha ao iniciar o servidor');
    process.exit(1);
  }

  if (process.env.NODE_ENV !== 'test') {
    startScheduler({
      intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS) || 60_000,
    });
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Sinal recebido — encerrando servidor');
    stopScheduler();

    // Aguarda Sentry enviar eventos pendentes antes de fechar
    await flushSentry(3000);

    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();