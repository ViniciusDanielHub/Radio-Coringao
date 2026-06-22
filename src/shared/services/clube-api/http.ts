const BASE_URL = process.env.CLUBE_API_URL || 'http://localhost:3010';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  accessToken ?: string;
 }

interface ClubeApiErrorBody {
  error?: string;
  details?: unknown;
}

export class ClubeApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ClubeApiError';
  }
}

function isErrorBody(value: unknown): value is ClubeApiErrorBody {
  return typeof value === 'object' && value !== null;
}

export async function request<TResponse, TBody = unknown>(
  path: string,
  options: RequestOptions<TBody> = {},
): Promise<TResponse> {
    const { method = 'GET', body, accessToken } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
   if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro de rede desconhecido';
    throw new ClubeApiError(503, `clube-api indisponível: ${message}`);
  }

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const errorBody = isErrorBody(data) ? data : undefined;
    throw new ClubeApiError(
      res.status,
      errorBody?.error ?? 'Erro na clube-api',
      errorBody?.details,
    );
  }

  return data as TResponse;
}