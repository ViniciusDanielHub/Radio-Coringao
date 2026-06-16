// src/shared/plugins/error-handler.plugin.ts
import type { FastifyInstance, FastifyError } from 'fastify';
import { AppError, ERROR_MESSAGES } from '../errors';
import { ErrorCode } from '../errors/error-codes';

// ─── Mapeamento de erros Prisma → AppError ────────────────────
const PRISMA_ERROR_MAP: Record<string, { status: number; code: string }> = {
  P2000: { status: 422, code: ErrorCode.VALIDATION_STRING_TOO_LONG   },
  P2001: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND          },
  P2002: { status: 409, code: ErrorCode.DB_UNIQUE_VIOLATION          },
  P2003: { status: 409, code: ErrorCode.DB_FOREIGN_KEY_VIOLATION      },
  P2004: { status: 400, code: ErrorCode.DB_QUERY_FAILED              },
  P2005: { status: 422, code: ErrorCode.VALIDATION_INVALID_FORMAT    },
  P2006: { status: 422, code: ErrorCode.VALIDATION_INVALID_FORMAT    },
  P2011: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD    },
  P2012: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD    },
  P2013: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD    },
  P2014: { status: 409, code: ErrorCode.DB_FOREIGN_KEY_VIOLATION      },
  P2015: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND          },
  P2016: { status: 400, code: ErrorCode.DB_QUERY_FAILED              },
  P2018: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND          },
  P2025: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND          },
};

// ─── Formatador de resposta de erro ──────────────────────────
function buildErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  isProd = false,
): Record<string, unknown> {
  const base: Record<string, unknown> = { code, error: message };
  if (!isProd && details !== undefined) {
    base.details = details;
  }
  return base;
}

export function registerErrorHandler(app: FastifyInstance): void {
  const isProd = process.env.NODE_ENV === 'production';

  // ─── Erros de rota ────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    const code = ErrorCode.ROUTE_NOT_FOUND;
    reply.code(404).send(
      buildErrorResponse(
        code,
        `Rota não encontrada: ${request.method} ${request.url}. Verifique a documentação da API.`,
        { method: request.method, url: request.url },
        isProd,
      ),
    );
  });

  // ─── Handler principal ────────────────────────────────────
  app.setErrorHandler((err: FastifyError & Partial<AppError>, request, reply) => {
    const isProdMode = isProd;

    // 1. AppError (nossos erros de domínio)
    if (err instanceof AppError) {
      app.log.warn({ code: err.code, url: request.url, method: request.method }, err.message);
      return reply.code(err.statusCode).send(
        buildErrorResponse(err.code, err.message, err.details, isProdMode),
      );
    }

    // 2. Erros Prisma
    const prismaCode = (err as any).code as string | undefined;
    if (prismaCode && PRISMA_ERROR_MAP[prismaCode]) {
      const mapped = PRISMA_ERROR_MAP[prismaCode];
      const meta   = (err as any).meta;

      let message = ERROR_MESSAGES[mapped.code] ?? 'Erro de banco de dados.';

      // enriquece mensagem para unicidade
      if (prismaCode === 'P2002' && meta?.target) {
        const field = Array.isArray(meta.target) ? meta.target.join(', ') : meta.target;
        message = `Já existe um registro com o valor informado para: ${field}.`;
      }

      app.log.warn({ prismaCode, meta, url: request.url }, message);
      return reply.code(mapped.status).send(
        buildErrorResponse(mapped.code, message, isProdMode ? undefined : meta, isProdMode),
      );
    }

    // 3. Tamanho de arquivo (multipart)
    if (err.message === 'File size limit reached' || err.statusCode === 413) {
      return reply.code(413).send(
        buildErrorResponse(
          ErrorCode.UPLOAD_TOO_LARGE,
          ERROR_MESSAGES[ErrorCode.UPLOAD_TOO_LARGE],
          { maxSizeMb: 5 },
          isProdMode,
        ),
      );
    }

    // 4. Rate limit (gerado pelo @fastify/rate-limit)
    if (err.statusCode === 429) {
      return reply.code(429).send(
        buildErrorResponse(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          ERROR_MESSAGES[ErrorCode.RATE_LIMIT_EXCEEDED],
          undefined,
          isProdMode,
        ),
      );
    }

    // 5. Erros de validação do schema Fastify/AJV
    if ((err as any).validation) {
      const details = (err as any).validation.map((v: any) => ({
        field:   v.instancePath?.replace('/', '') || v.params?.missingProperty || 'campo desconhecido',
        message: translateAjvMessage(v),
        value:   v.data,
      }));
      return reply.code(422).send(
        buildErrorResponse(
          ErrorCode.VALIDATION_INVALID_FORMAT,
          'Dados inválidos. Verifique os campos enviados.',
          details,
          isProdMode,
        ),
      );
    }

    // 6. Erros de JWT (passam pelo plugin de auth antes de chegar aqui)
    if (err.message === 'JsonWebTokenError' || err.name === 'JsonWebTokenError') {
      return reply.code(401).send(
        buildErrorResponse(ErrorCode.AUTH_TOKEN_INVALID, ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_INVALID]),
      );
    }
    if (err.name === 'TokenExpiredError') {
      return reply.code(401).send(
        buildErrorResponse(ErrorCode.AUTH_TOKEN_EXPIRED, ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_EXPIRED]),
      );
    }

    // 7. Erros 4xx com statusCode conhecido
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send(
        buildErrorResponse(ErrorCode.INTERNAL_ERROR, err.message),
      );
    }

    // 8. Erro interno (500)
    app.log.error({ err, url: request.url, method: request.method }, 'Unhandled error');
    const publicMessage = isProdMode
      ? ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]
      : (err.message || ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]);

    reply.code(500).send(
      buildErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        publicMessage,
        isProdMode ? undefined : { stack: err.stack },
        isProdMode,
      ),
    );
  });
}

// ─── Tradutor de mensagens AJV para PT-BR ────────────────────
function translateAjvMessage(v: any): string {
  const kw = v.keyword;
  const p  = v.params;
  const translations: Record<string, string> = {
    required:    `Campo obrigatório: "${p?.missingProperty}"`,
    minLength:   `Mínimo de ${p?.limit} caractere(s)`,
    maxLength:   `Máximo de ${p?.limit} caractere(s)`,
    minimum:     `Valor mínimo: ${p?.limit}`,
    maximum:     `Valor máximo: ${p?.limit}`,
    type:        `Tipo inválido. Esperado: ${p?.type}`,
    format:      `Formato inválido para: ${p?.format}`,
    enum:        `Valor inválido. Aceito: ${p?.allowedValues?.join(', ')}`,
    pattern:     `Formato não corresponde ao padrão esperado`,
    additionalProperties: `Propriedade não permitida: "${p?.additionalProperty}"`,
  };
  return translations[kw] ?? v.message ?? 'Valor inválido';
}
