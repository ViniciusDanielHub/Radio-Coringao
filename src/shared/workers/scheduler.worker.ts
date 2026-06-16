// src/shared/workers/scheduler.worker.ts
import { prisma } from '../database/prisma';

const DEFAULT_INTERVAL_MS = 60_000; // 1 minuto

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;
let _consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

async function publishScheduledArticles(): Promise<void> {
  if (_running) return; // evita execuções sobrepostas
  _running = true;

  try {
    const now = new Date();

    let articles: { id: string; title: string; scheduledAt: Date | null }[];

    try {
      articles = await prisma.article.findMany({
        where: {
          scheduledAt: { lte: now },
          status: { in: ['DRAFT', 'REVIEW'] },
        },
        select: { id: true, title: true, scheduledAt: true },
      });
    } catch (dbErr: any) {
      _consecutiveErrors++;
      console.error(
        `[Scheduler] Erro ao consultar artigos agendados (tentativa ${_consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
        dbErr?.message ?? dbErr,
      );

      if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(
          `[Scheduler] ${MAX_CONSECUTIVE_ERRORS} erros consecutivos detectados. ` +
          'Verifique a conexão com o banco de dados.',
        );
      }
      return;
    }

    if (articles.length === 0) {
      _consecutiveErrors = 0;
      return;
    }

    const results = await Promise.allSettled(
      articles.map((article) =>
        prisma.article.update({
          where: { id: article.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: article.scheduledAt ?? now,
          },
        }),
      ),
    );

    const succeeded: string[] = [];
    const failed: string[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded.push(articles[i].title);
      } else {
        failed.push(articles[i].title);
        console.error(
          `[Scheduler] Falha ao publicar "${articles[i].title}":`,
          result.reason?.message ?? result.reason,
        );
      }
    });

    if (succeeded.length > 0) {
      console.log(`[Scheduler] ${succeeded.length} artigo(s) publicado(s):`, succeeded);
    }
    if (failed.length > 0) {
      console.warn(`[Scheduler] ${failed.length} artigo(s) falharam na publicação:`, failed);
    }

    _consecutiveErrors = 0;
  } catch (err: any) {
    _consecutiveErrors++;
    console.error('[Scheduler] Erro inesperado:', err?.message ?? err);
  } finally {
    _running = false;
  }
}

// ─── API pública ──────────────────────────────────────────────
export function startScheduler(options?: { intervalMs?: number }): void {
  if (_timer) {
    console.warn('[Scheduler] Já está rodando. Ignorando startScheduler().');
    return;
  }

  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  if (interval < 10_000) {
    console.warn(`[Scheduler] Intervalo muito baixo (${interval}ms). Mínimo recomendado: 10.000ms.`);
  }

  console.log(`[Scheduler] Iniciado. Verificando a cada ${interval / 1000}s.`);

  // Executa imediatamente ao iniciar
  publishScheduledArticles();

  _timer = setInterval(() => {
    publishScheduledArticles();
  }, interval);

  // Garante que o timer não bloqueia o processo
  if (_timer.unref) _timer.unref();
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    _running = false;
    _consecutiveErrors = 0;
    console.log('[Scheduler] Parado.');
  }
}

export function getSchedulerStatus(): {
  running: boolean;
  active: boolean;
  consecutiveErrors: number;
} {
  return {
    running: _running,
    active: _timer !== null,
    consecutiveErrors: _consecutiveErrors,
  };
}