// src/shared/workers/scheduler.worker.ts
import { prisma } from '../database/prisma';

const INTERVAL_MS = 60_000; // verifica a cada 1 minuto

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;

async function publishScheduledArticles(): Promise<void> {
  if (_running) return; // evita execuções sobrepostas
  _running = true;

  try {
    const now = new Date();

    const articles = await prisma.article.findMany({
      where: {
        scheduledAt: { lte: now },
        status: { in: ['DRAFT', 'REVIEW'] },
      },
      select: { id: true, title: true, scheduledAt: true },
    });

    if (articles.length === 0) {
      _running = false;
      return;
    }

    await Promise.all(
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

    console.log(
      `[Scheduler] ${articles.length} artigo(s) publicado(s):`,
      articles.map((a) => `"${a.title}" (agendado: ${a.scheduledAt?.toISOString()})`),
    );
  } catch (err: any) {
    console.error('[Scheduler] Erro ao publicar artigos agendados:', err.message);
  } finally {
    _running = false;
  }
}

// ─── API pública ──────────────────────────────────────────────
export function startScheduler(options?: { intervalMs?: number }): void {
  if (_timer) {
    console.warn('[Scheduler] Já está rodando.');
    return;
  }

  const interval = options?.intervalMs ?? INTERVAL_MS;

  console.log(`[Scheduler] Iniciado. Verificando a cada ${interval / 1000}s.`);

  // Executa imediatamente ao iniciar
  publishScheduledArticles().catch(console.error);

  _timer = setInterval(() => {
    publishScheduledArticles().catch(console.error);
  }, interval);
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    console.log('[Scheduler] Parado.');
  }
}