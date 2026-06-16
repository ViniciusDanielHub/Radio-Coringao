import type { FastifyInstance, FastifyError } from 'fastify';
import { AppError, ERROR_MESSAGES } from '../errors';
import { ErrorCode } from '../errors/error-codes';

// ─── Mapeamento de erros Prisma → AppError ────────────────────
const PRISMA_ERROR_MAP: Record<string, { status: number; code: string }> = {
  P2000: { status: 422, code: ErrorCode.VALIDATION_STRING_TOO_LONG },
  P2001: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND },
  P2002: { status: 409, code: ErrorCode.DB_UNIQUE_VIOLATION },
  P2003: { status: 409, code: ErrorCode.DB_FOREIGN_KEY_VIOLATION },
  P2004: { status: 400, code: ErrorCode.DB_QUERY_FAILED },
  P2005: { status: 422, code: ErrorCode.VALIDATION_INVALID_FORMAT },
  P2006: { status: 422, code: ErrorCode.VALIDATION_INVALID_FORMAT },
  P2011: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD },
  P2012: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD },
  P2013: { status: 422, code: ErrorCode.VALIDATION_REQUIRED_FIELD },
  P2014: { status: 409, code: ErrorCode.DB_FOREIGN_KEY_VIOLATION },
  P2015: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND },
  P2016: { status: 400, code: ErrorCode.DB_QUERY_FAILED },
  P2017: { status: 400, code: ErrorCode.DB_FOREIGN_KEY_VIOLATION },
  P2018: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND },
  P2019: { status: 400, code: ErrorCode.DB_QUERY_FAILED },
  P2020: { status: 422, code: ErrorCode.VALIDATION_NUMBER_OUT_OF_RANGE },
  P2021: { status: 500, code: ErrorCode.DB_QUERY_FAILED },
  P2022: { status: 500, code: ErrorCode.DB_QUERY_FAILED },
  P2023: { status: 422, code: ErrorCode.VALIDATION_INVALID_FORMAT },
  P2024: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
  P2025: { status: 404, code: ErrorCode.DB_RECORD_NOT_FOUND },
  P2026: { status: 400, code: ErrorCode.DB_QUERY_FAILED },
  P2033: { status: 422, code: ErrorCode.VALIDATION_NUMBER_OUT_OF_RANGE },
  P1001: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
  P1002: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
  P1008: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
  P1009: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
  P1017: { status: 503, code: ErrorCode.DB_CONNECTION_ERROR },
};

// ─── Formatador de resposta de erro ──────────────────────────
function buildErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  isProd = false,
): Record<string, unknown> {
  const base: Record<string, unknown> = { code, error: message };
  if (!isProd && details !== undefined) base.details = details;
  return base;
}

// ─── Enriquece mensagem de violação única do Prisma ──────────
function enrichUniqueMessage(meta: any): string {
  if (!meta?.target) return ERROR_MESSAGES[ErrorCode.DB_UNIQUE_VIOLATION];

  const fieldMap: Record<string, string> = {
    email: 'E-mail já cadastrado.',
    slug: 'Já existe um registro com este slug.',
    name: 'Já existe um registro com este nome.',
    token: 'Token já utilizado.',
    users_email_key: 'E-mail já cadastrado.',
    categories_name_key: 'Já existe uma categoria com este nome.',
    categories_slug_key: 'Já existe uma categoria com este slug.',
    tags_name_key: 'Já existe uma tag com este nome.',
    tags_slug_key: 'Já existe uma tag com este slug.',
    articles_slug_key: 'Já existe um artigo com este slug.',
    refresh_tokens_token_key: 'Token inválido.',
  };

  const fields: string[] = Array.isArray(meta.target)
    ? meta.target
    : [String(meta.target)];

  const key = fields.join('_');
  for (const [k, msg] of Object.entries(fieldMap)) {
    if (key.toLowerCase().includes(k.toLowerCase())) return msg;
  }

  return `Já existe um registro com o valor informado para: ${fields.join(', ')}.`;
}

export function registerErrorHandler(app: FastifyInstance): void {
  const isProd = process.env.NODE_ENV === 'production';

  // ─── 404 — Rota não encontrada ────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    const code = ErrorCode.ROUTE_NOT_FOUND;
    // request.log carrega requestId automaticamente pelo Fastify
    request.log.warn({ method: request.method, url: request.url }, 'Rota não encontrada');
    reply.code(404).send(
      buildErrorResponse(
        code,
        `Rota não encontrada: ${request.method} ${request.url}.`,
        !isProd ? { method: request.method, url: request.url } : undefined,
        isProd,
      ),
    );
  });

  // ─── Handler principal ────────────────────────────────────
  app.setErrorHandler((err: FastifyError & Partial<AppError>, request, reply) => {
    // request.log é o logger correto aqui: Fastify injeta requestId, method,
    // url e outros campos de contexto automaticamente em cada requisição.

    // ── 1. AppError (nossos erros de domínio) ──
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        request.log.error(
          { err, code: err.code, statusCode: err.statusCode },
          err.message,
        );
      } else {
        request.log.warn(
          { code: err.code, statusCode: err.statusCode, details: err.details },
          err.message,
        );
      }
      return reply.code(err.statusCode).send(
        buildErrorResponse(err.code, err.message, err.details, isProd),
      );
    }

    // ── 2. Erros do Prisma (P1xxx / P2xxx) ──
    const prismaCode = (err as any).code as string | undefined;
    if (prismaCode && PRISMA_ERROR_MAP[prismaCode]) {
      const mapped = PRISMA_ERROR_MAP[prismaCode];
      const meta = (err as any).meta;
      const message = prismaCode === 'P2002'
        ? enrichUniqueMessage(meta)
        : (ERROR_MESSAGES[mapped.code] ?? 'Erro de banco de dados.');

      request.log.warn({ prismaCode, meta, statusCode: mapped.status }, message);
      return reply.code(mapped.status).send(
        buildErrorResponse(mapped.code, message, isProd ? undefined : meta, isProd),
      );
    }

    // ── 3. JSON inválido no body ──
    if (
      err.message?.includes('Unexpected token') ||
      err.message?.includes('Unexpected end of JSON') ||
      (err.statusCode === 400 && err.message?.toLowerCase().includes('json'))
    ) {
      request.log.warn({ errMessage: err.message }, 'JSON inválido no body da requisição');
      return reply.code(400).send(
        buildErrorResponse(
          ErrorCode.VALIDATION_JSON_INVALID,
          ERROR_MESSAGES[ErrorCode.VALIDATION_JSON_INVALID],
        ),
      );
    }

    // ── 4. Content-Type não suportado (415) ──
    if (err.statusCode === 415) {
      request.log.warn({ contentType: request.headers['content-type'] }, 'Content-Type não suportado');
      return reply.code(415).send(
        buildErrorResponse(
          ErrorCode.VALIDATION_BODY_MISSING,
          'Content-Type não suportado. Use application/json ou multipart/form-data.',
        ),
      );
    }

    // ── 5. Arquivo muito grande (413) ──
    if (
      err.message === 'File size limit reached' ||
      (err as any).code === 'FST_FILES_LIMIT' ||
      err.statusCode === 413
    ) {
      request.log.warn({ errMessage: err.message }, 'Upload excedeu o tamanho máximo');
      return reply.code(413).send(
        buildErrorResponse(
          ErrorCode.UPLOAD_TOO_LARGE,
          ERROR_MESSAGES[ErrorCode.UPLOAD_TOO_LARGE],
          { maxSizeMb: 5 },
          isProd,
        ),
      );
    }

    // ── 6. Rate limit (429) ──
    if (err.statusCode === 429) {
      const retryAfter = (err as any).date
        ? Math.ceil(((err as any).date - Date.now()) / 1000)
        : 900;
      request.log.warn({ retryAfterSeconds: retryAfter }, 'Rate limit atingido');
      reply.header('Retry-After', String(retryAfter));
      return reply.code(429).send(
        buildErrorResponse(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          ERROR_MESSAGES[ErrorCode.RATE_LIMIT_EXCEEDED],
          !isProd ? { retryAfterSeconds: retryAfter } : undefined,
          isProd,
        ),
      );
    }

    // ── 7. Método não permitido (405) ──
    if (err.statusCode === 405) {
      request.log.warn({ method: request.method, url: request.url }, 'Método HTTP não permitido');
      return reply.code(405).send(
        buildErrorResponse(
          ErrorCode.METHOD_NOT_ALLOWED,
          ERROR_MESSAGES[ErrorCode.METHOD_NOT_ALLOWED],
          !isProd ? { method: request.method, url: request.url } : undefined,
          isProd,
        ),
      );
    }

    // ── 8. Erros de validação do schema Fastify/AJV ──
    if ((err as any).validation) {
      const details = (err as any).validation.map((v: any) => ({
        field: v.instancePath?.replace(/^\//, '') || v.params?.missingProperty || 'campo desconhecido',
        message: translateAjvMessage(v),
        value: !isProd ? v.data : undefined,
      })).filter(Boolean);

      request.log.warn({ validationErrors: details }, 'Validação de schema falhou');
      return reply.code(422).send(
        buildErrorResponse(
          ErrorCode.VALIDATION_INVALID_FORMAT,
          'Dados inválidos. Verifique os campos enviados.',
          details,
          isProd,
        ),
      );
    }

    // ── 9. Erros de JWT ──
    if (err.name === 'JsonWebTokenError' || err.message === 'JsonWebTokenError') {
      request.log.warn({ errName: err.name }, 'Token JWT inválido');
      return reply.code(401).send(
        buildErrorResponse(ErrorCode.AUTH_TOKEN_INVALID, ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_INVALID]),
      );
    }
    if (err.name === 'TokenExpiredError') {
      request.log.warn('Token JWT expirado');
      return reply.code(401).send(
        buildErrorResponse(ErrorCode.AUTH_TOKEN_EXPIRED, ERROR_MESSAGES[ErrorCode.AUTH_TOKEN_EXPIRED]),
      );
    }
    if (err.name === 'NotBeforeError') {
      return reply.code(401).send(
        buildErrorResponse(ErrorCode.AUTH_TOKEN_INVALID, 'Token ainda não é válido.'),
      );
    }

    // ── 10. Timeout / serviço indisponível ──
    if (err.statusCode === 503 || err.message?.includes('timeout') || err.name === 'TimeoutError') {
      request.log.warn({ errName: err.name, errMessage: err.message }, 'Timeout ou serviço indisponível');
      return reply.code(503).send(
        buildErrorResponse(ErrorCode.TIMEOUT, ERROR_MESSAGES[ErrorCode.TIMEOUT]),
      );
    }

    // ── 11. Erros 4xx conhecidos sem handler específico ──
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      request.log.warn({ statusCode: err.statusCode, errMessage: err.message }, 'Erro 4xx sem handler específico');
      return reply.code(err.statusCode).send(
        buildErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          isProd ? ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR] : err.message,
        ),
      );
    }

    // ── 12. Erro interno (500) — fallback ──
    // Este é o único caso onde um 500 inesperado pode escapar de todos os handlers acima.
    // Logamos com nível error e incluímos stack trace fora de produção.
    request.log.error(
      { err, statusCode: err.statusCode ?? 500 },
      'Erro interno não tratado',
    );

    reply.code(500).send(
      buildErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        isProd
          ? ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]
          : (err.message || ERROR_MESSAGES[ErrorCode.INTERNAL_ERROR]),
        isProd ? undefined : { stack: err.stack },
        isProd,
      ),
    );
  });
}

// ─── Tradutor de mensagens AJV para PT-BR ────────────────────
function translateAjvMessage(v: any): string {
  const kw = v.keyword;
  const p = v.params;

  const translations: Record<string, () => string> = {
    required: () => `Campo obrigatório: "${p?.missingProperty}"`,
    minLength: () => `Mínimo de ${p?.limit} caractere(s)`,
    maxLength: () => `Máximo de ${p?.limit} caractere(s)`,
    minimum: () => `Valor mínimo permitido: ${p?.limit}`,
    maximum: () => `Valor máximo permitido: ${p?.limit}`,
    exclusiveMinimum: () => `Valor deve ser maior que ${p?.limit}`,
    exclusiveMaximum: () => `Valor deve ser menor que ${p?.limit}`,
    type: () => `Tipo inválido. Esperado: ${p?.type}`,
    format: () => formatMessage(p?.format),
    enum: () => `Valor inválido. Aceitos: ${p?.allowedValues?.join(', ')}`,
    pattern: () => 'Formato não corresponde ao padrão esperado.',
    additionalProperties: () => `Propriedade não permitida: "${p?.additionalProperty}"`,
    minItems: () => `Mínimo de ${p?.limit} item(ns) no array`,
    maxItems: () => `Máximo de ${p?.limit} item(ns) no array`,
    uniqueItems: () => 'Os itens do array devem ser únicos.',
    const: () => `Valor deve ser exatamente: ${JSON.stringify(p?.allowedValue)}`,
    multipleOf: () => `O valor deve ser múltiplo de ${p?.multipleOf}`,
    if: () => 'Condição de validação não atendida.',
    not: () => 'Valor não é permitido.',
  };

  return translations[kw]?.() ?? v.message ?? 'Valor inválido.';
}

function formatMessage(format: string): string {
  const formats: Record<string, string> = {
    'email': 'E-mail inválido.',
    'uri': 'URL inválida.',
    'uuid': 'UUID inválido.',
    'date': 'Data inválida (esperado: YYYY-MM-DD).',
    'date-time': 'Data/hora inválida (esperado: ISO 8601).',
    'time': 'Hora inválida (esperado: HH:MM:SS).',
    'ipv4': 'Endereço IPv4 inválido.',
    'ipv6': 'Endereço IPv6 inválido.',
    'hostname': 'Hostname inválido.',
  };
  return formats[format] ?? `Formato inválido: ${format}.`;
}