// src/shared/validators.ts
// Funções de validação reutilizáveis em toda a aplicação.

import { ValidationError, AppError } from './errors';
import { ErrorCode } from './errors/error-codes';

// ─── Regex ────────────────────────────────────────────────────
const HEX_COLOR_RE  = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const UUID_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_RE        = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w\-./?%&=]*)?$/;
const EMAIL_RE      = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIVE_URL_RE = /^\//;

// ─── Strings ──────────────────────────────────────────────────

/** Garante que uma string não é vazia */
export function requireString(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {},
): string {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(
      ErrorCode.VALIDATION_REQUIRED_FIELD,
      { field: fieldName, message: `O campo "${fieldName}" é obrigatório.` },
    );
  }
  const str = String(value).trim();
  if (options.min !== undefined && str.length < options.min) {
    throw new ValidationError(
      ErrorCode.VALIDATION_STRING_TOO_SHORT,
      { field: fieldName, min: options.min, length: str.length },
    );
  }
  if (options.max !== undefined && str.length > options.max) {
    throw new ValidationError(
      ErrorCode.VALIDATION_STRING_TOO_LONG,
      { field: fieldName, max: options.max, length: str.length },
    );
  }
  return str;
}

/** Valida e-mail */
export function validateEmail(email: string): void {
  if (!EMAIL_RE.test(email.trim())) {
    throw new ValidationError(ErrorCode.VALIDATION_INVALID_EMAIL, { value: email });
  }
}

/** Valida UUID v4 */
export function validateUUID(id: string, fieldName = 'id'): void {
  if (!UUID_RE.test(id)) {
    throw new ValidationError(
      ErrorCode.VALIDATION_INVALID_UUID,
      { field: fieldName, value: id },
    );
  }
}

// ─── Cores ────────────────────────────────────────────────────

/** Valida cor hexadecimal (#RGB ou #RRGGBB) */
export function validateHexColor(color: string | undefined | null, field = 'color'): void {
  if (!color) return;
  if (!HEX_COLOR_RE.test(color)) {
    throw new ValidationError(
      ErrorCode.CATEGORY_COLOR_INVALID,
      { field, value: color },
    );
  }
}

// ─── URLs ─────────────────────────────────────────────────────

/** Valida URL (absoluta ou relativa) */
export function validateUrl(url: string | undefined | null, field = 'url'): void {
  if (!url) return;
  if (!URL_RE.test(url) && !RELATIVE_URL_RE.test(url)) {
    throw new ValidationError(
      ErrorCode.VALIDATION_INVALID_URL,
      { field, value: url },
    );
  }
}

// ─── Datas ────────────────────────────────────────────────────

/** Converte e valida uma string de data */
export function parseDate(value: string | undefined | null, field = 'date'): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new ValidationError(
      ErrorCode.VALIDATION_INVALID_DATE,
      { field, value },
    );
  }
  return d;
}

/** Garante que a data está no futuro */
export function requireFutureDate(value: string | Date, field = 'date'): Date {
  const d = typeof value === 'string' ? parseDate(value, field)! : value;
  if (d <= new Date()) {
    throw new ValidationError(
      ErrorCode.ARTICLE_SCHEDULED_PAST,
      { field, value: d.toISOString() },
    );
  }
  return d;
}

/** Valida intervalo de datas */
export function validateDateRange(
  from: string | undefined | null,
  to: string | undefined | null,
): { from: Date | null; to: Date | null } {
  const dateFrom = parseDate(from, 'dateFrom');
  const dateTo   = parseDate(to, 'dateTo');
  if (dateFrom && dateTo && dateFrom >= dateTo) {
    throw new ValidationError(
      ErrorCode.LIVE_SCORES_DATE_RANGE_INVALID,
      { dateFrom: from, dateTo: to },
    );
  }
  return { from: dateFrom, to: dateTo };
}

// ─── Paginação ────────────────────────────────────────────────

export interface PaginationInput {
  page:  number;
  limit: number;
}

export function parsePagination(
  raw: { page?: unknown; limit?: unknown },
  maxLimit = 100,
): PaginationInput {
  const page = Number(raw.page) || 1;
  const limit = Number(raw.limit) || 20;

  if (!Number.isInteger(page) || page < 1) {
    throw new ValidationError(ErrorCode.PAGINATION_PAGE_INVALID, { page: raw.page });
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new ValidationError(ErrorCode.PAGINATION_LIMIT_INVALID, { limit: raw.limit });
  }
  if (limit > maxLimit) {
    throw new ValidationError(
      ErrorCode.PAGINATION_LIMIT_TOO_HIGH,
      { max: maxLimit, received: limit },
    );
  }

  return { page, limit };
}

// ─── Enums ────────────────────────────────────────────────────
const VALID_ARTICLE_STATUSES = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;
const VALID_ARTICLE_TYPES    = ['NEWS', 'ANALYSIS', 'INTERVIEW', 'LIVE', 'GALLERY'] as const;
const VALID_MATCH_STATUSES   = [
  'SCHEDULED', 'LIVE', 'IN_PLAY', 'PAUSED', 'FINISHED',
  'POSTPONED', 'CANCELLED', 'SUSPENDED',
] as const;
const VALID_ROLES = [
  'SUPER_ADMIN', 'EDITOR_CHEFE', 'EDITOR', 'JORNALISTA',
  'COLUNISTA', 'SOCIAL_MEDIA', 'MODERADOR', 'SEO_MANAGER',
] as const;

export function validateArticleStatus(status: string): void {
  if (!VALID_ARTICLE_STATUSES.includes(status as any)) {
    throw new ValidationError(
      ErrorCode.ARTICLE_INVALID_STATUS,
      { received: status, accepted: VALID_ARTICLE_STATUSES },
    );
  }
}

export function validateArticleType(type: string): void {
  if (!VALID_ARTICLE_TYPES.includes(type as any)) {
    throw new ValidationError(
      ErrorCode.ARTICLE_INVALID_TYPE,
      { received: type, accepted: VALID_ARTICLE_TYPES },
    );
  }
}

export function validateMatchStatus(status: string): void {
  if (!VALID_MATCH_STATUSES.includes(status.toUpperCase() as any)) {
    throw new ValidationError(
      ErrorCode.LIVE_SCORES_STATUS_INVALID,
      { received: status, accepted: VALID_MATCH_STATUSES },
    );
  }
}

export function validateRole(role: string): void {
  if (!VALID_ROLES.includes(role as any)) {
    throw new ValidationError(
      ErrorCode.USER_INVALID_ROLE,
      { received: role, accepted: VALID_ROLES },
    );
  }
}

// ─── Números ──────────────────────────────────────────────────

export function validateMatchday(matchday: number): void {
  if (!Number.isInteger(matchday) || matchday < 1 || matchday > 38) {
    throw new ValidationError(
      ErrorCode.LIVE_SCORES_MATCHDAY_INVALID,
      { received: matchday, range: '1-38' },
    );
  }
}

export function validatePositiveInt(value: unknown, field: string, max?: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ValidationError(
      ErrorCode.VALIDATION_NUMBER_OUT_OF_RANGE,
      { field, received: value, min: 1 },
    );
  }
  if (max !== undefined && n > max) {
    throw new ValidationError(
      ErrorCode.PAGINATION_LIMIT_TOO_HIGH,
      { field, received: n, max },
    );
  }
  return n;
}

// ─── Senha ────────────────────────────────────────────────────

export function validatePassword(password: string): void {
  if (!password || password.length < 8) {
    throw new ValidationError(
      ErrorCode.USER_WEAK_PASSWORD,
      { minLength: 8 },
    );
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  if (!hasLetter || !hasNumber) {
    throw new ValidationError(
      ErrorCode.USER_WEAK_PASSWORD,
      { hint: 'A senha deve conter pelo menos uma letra e um número.' },
    );
  }
}

// ─── Arquivo de imagem ────────────────────────────────────────
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function validateImageMimetype(mimetype: string): void {
  if (!VALID_IMAGE_TYPES.includes(mimetype.toLowerCase())) {
    throw new ValidationError(
      ErrorCode.UPLOAD_INVALID_TYPE,
      { received: mimetype, accepted: VALID_IMAGE_TYPES },
    );
  }
}

export function validateImageSize(sizeBytes: number, maxMb = 5): void {
  if (sizeBytes > maxMb * 1024 * 1024) {
    throw new ValidationError(
      ErrorCode.UPLOAD_TOO_LARGE,
      { maxMb, receivedBytes: sizeBytes },
    );
  }
}

// ─── Variáveis de ambiente ────────────────────────────────────

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new AppError(
      ErrorCode.ENV_MISSING,
      500,
      ErrorCode.ENV_MISSING,
      { variable: key, hint: `Configure ${key} no arquivo .env` },
    );
  }
  return val;
}
