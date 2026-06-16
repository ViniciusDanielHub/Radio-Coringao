// src/server.ts
import 'dotenv/config';
import { buildApp } from './app';
import { startScheduler, stopScheduler } from './shared/workers/scheduler.worker';

const PORT = Number(process.env.PORT) || 3000;

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🏠 Health: http://localhost:${PORT}/api/health\n`);
  } catch (err) {
    app.log.error(err);
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
    console.log(`\n⚠️  Recebido ${signal}. Encerrando servidor...`);
    stopScheduler();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();