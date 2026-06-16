import 'dotenv/config';
import { checkEnv } from './shared/env-check';
import { buildApp } from './app';
import { logger } from './shared/logger';
import { startScheduler, stopScheduler } from './shared/workers/scheduler.worker';

// Valida variáveis de ambiente antes de iniciar
checkEnv();

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const app = await buildApp();

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

  // ─── Scheduler ────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'test') {
    startScheduler({
      intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS) || 60_000,
    });
  }

  // ─── Graceful shutdown ────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Sinal recebido — encerrando servidor');
    stopScheduler();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();