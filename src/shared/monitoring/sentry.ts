import { logger } from '../logger';

const log = logger.child({ service: 'Sentry' });

type SentryClient = {
  captureException(err: unknown, context?: Record<string, unknown>): string | undefined;
  captureMessage(msg: string, level?: string, context?: Record<string, unknown>): string | undefined;
  setUser(user: { id: string; role?: string } | null): void;
  flush(timeoutMs?: number): Promise<boolean>;
};

let _sentry: SentryClient | null = null;
let _initialized = false;

// ─── Inicialização (chamar uma vez no bootstrap do app) ───────

export function initSentry(): void {
  if (_initialized) return;
  _initialized = true;

  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    log.info('SENTRY_DSN não configurado — monitoramento de erros desativado');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      // release: process.env.npm_package_version, // descomente para rastrear por versão
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,   // 10% das transações
      // Ignora erros operacionais esperados (4xx) — só queremos 5xx inesperados
      ignoreErrors: [
        'AppError',
        'ValidationError',
        'NotFoundError',
        'UnauthorizedError',
        'ForbiddenError',
        'ConflictError',
      ],
      beforeSend(event: any, hint: any) {
        // Remove dados sensíveis antes de enviar ao Sentry
        if (event.request?.data) {
          const body = event.request.data;
          if (typeof body === 'object') {
            ['password', 'currentPassword', 'newPassword', 'token', 'refreshToken'].forEach(k => {
              if (k in body) body[k] = '[REDACTED]';
            });
          }
        }
        return event;
      },
    });

    _sentry = {
      captureException: (err, ctx) => Sentry.captureException(err, { extra: ctx }),
      captureMessage: (msg, level = 'error', ctx) =>
        Sentry.captureMessage(msg, { level, extra: ctx }),
      setUser: (user) => Sentry.setUser(user),
      flush: (ms = 2000) => Sentry.flush(ms),
    };

    log.info(
      { environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV },
      'Sentry inicializado',
    );
  } catch (err: any) {
    log.warn(
      { err: err.message },
      'Falha ao inicializar Sentry. Instale o pacote: npm install @sentry/node',
    );
  }
}

// ─── API pública ──────────────────────────────────────────────

/**
 * Captura um erro inesperado e envia ao Sentry.
 * Sempre loga o erro localmente, independente do Sentry estar ativo.
 *
 * @param err      O erro a capturar
 * @param context  Dados extras para facilitar investigação (userId, requestId, etc.)
 */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  log.error({ err, ...context }, 'Erro capturado');
  _sentry?.captureException(err, context);
}

/**
 * Captura uma mensagem de alerta (sem erro) — útil para anomalias operacionais.
 * Ex: scheduler com erros consecutivos, rate limit atingido por IP específico.
 */
export function captureWarning(message: string, context?: Record<string, unknown>): void {
  log.warn({ ...context }, message);
  _sentry?.captureMessage(message, 'warning', context);
}

/**
 * Associa o usuário autenticado ao scope do Sentry.
 * Chame no `authenticate` plugin após validar o JWT.
 * Passe `null` no logout.
 */
export function setSentryUser(user: { id: string; role?: string } | null): void {
  _sentry?.setUser(user);
}

/**
 * Aguarda o Sentry enviar eventos pendentes antes do shutdown.
 * Chame no graceful shutdown do servidor.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  await _sentry?.flush(timeoutMs);
}

/** Retorna true se o Sentry está ativo (para feature-flags em testes) */
export function isSentryEnabled(): boolean {
  return _sentry !== null;
}