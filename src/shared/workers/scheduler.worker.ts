import { prisma } from '../database/prisma';
import { logger } from '../logger';

const log = logger.child({ worker: 'scheduler' });

const DEFAULT_INTERVAL_MS = 60_000; // 1 minuto

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;
let _consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;

async function publishScheduledArticles(): Promise<void> {
  if (_running) return; 
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
      log.error(
        { err: dbErr, consecutiveErrors: _consecutiveErrors, maxConsecutiveErrors: MAX_CONSECUTIVE_ERRORS },
        'Erro ao consultar artigos agendados',
      );

      if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log.error(
          { consecutiveErrors: _consecutiveErrors },
          'Limite de erros consecutivos atingido — verifique a conexão com o banco de dados',
        );
      }
      return;
    }

    if (articles.length === 0) {
      _consecutiveErrors = 0;
      log.debug({ checkedAt: now.toISOString() }, 'Nenhum artigo agendado para publicar');
      return;
    }

    log.info({ count: articles.length }, 'Artigos agendados encontrados para publicação');

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
    const failed: { id: string; title: string; error: string }[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        succeeded.push(articles[i].id);
      } else {
        failed.push({
          id: articles[i].id,
          title: articles[i].title,
          error: result.reason?.message ?? String(result.reason),
        });
      }
    });

    if (succeeded.length > 0) {
      log.info({ articleIds: succeeded, count: succeeded.length }, 'Artigos publicados pelo scheduler');
    }
    if (failed.length > 0) {
      log.warn({ failed, count: failed.length }, 'Falha ao publicar alguns artigos agendados');
    }

    _consecutiveErrors = 0;
  } catch (err: any) {
    _consecutiveErrors++;
    log.error({ err, consecutiveErrors: _consecutiveErrors }, 'Erro inesperado no scheduler');
  } finally {
    _running = false;
  }
}

// ─── API pública ──────────────────────────────────────────────

export function startScheduler(options?: { intervalMs?: number }): void {
  if (_timer) {
    log.warn('Scheduler já está rodando — ignorando startScheduler()');
    return;
  }

  const interval = options?.intervalMs ?? DEFAULT_INTERVAL_MS;

  if (interval < 10_000) {
    log.warn(
      { intervalMs: interval, recommendedMinMs: 10_000 },
      'Intervalo do scheduler muito baixo',
    );
  }

  log.info({ intervalMs: interval }, 'Scheduler iniciado');

  // Executa imediatamente ao iniciar, sem aguardar o primeiro tick
  publishScheduledArticles();

  _timer = setInterval(() => {
    publishScheduledArticles();
  }, interval);

  // Garante que o timer não bloqueia o processo ao encerrar
  if (_timer.unref) _timer.unref();
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    _running = false;
    _consecutiveErrors = 0;
    log.info('Scheduler parado');
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