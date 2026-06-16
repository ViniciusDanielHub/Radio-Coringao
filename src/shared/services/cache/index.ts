import { logger } from '../../logger';

const log = logger.child({ service: 'CacheService' });

// ─── Interface comum ──────────────────────────────────────────

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Retorna o backend ativo (para logs/health-check) */
  readonly backend: 'memory' | 'redis';
}

// ─── Backend in-memory ────────────────────────────────────────

interface MemEntry { data: unknown; expiresAt: number }

export class InMemoryCache implements ICacheService {
  readonly backend = 'memory' as const;
  private readonly store = new Map<string, MemEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

// ─── Backend Redis ────────────────────────────────────────────
//
// A dependência `ioredis` é opcional — só é importada em runtime se
// REDIS_URL estiver configurado. Isso evita erros de import em ambientes
// sem Redis e mantém o pacote leve quando não é necessário.

export class RedisCache implements ICacheService {
  readonly backend = 'redis' as const;
  private client: any; // ioredis.Redis — tipagem lazy para evitar import obrigatório

  constructor(redisUrl: string) {
    // Dynamic require para que a ausência do pacote não quebre o build
    // quando Redis não é usado. Em produção com Redis, adicione ioredis:
    //   npm install ioredis
    //   npm install --save-dev @types/ioredis (opcional — ioredis inclui tipos)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      });

      this.client.on('connect', () => log.info({ redisUrl: redisUrl.replace(/:\/\/.*@/, '://***@') }, 'Redis conectado'));
      this.client.on('error', (err: any) => log.error({ err }, 'Erro na conexão Redis'));
    } catch (err: any) {
      log.error({ err }, 'Falha ao criar cliente Redis — certifique-se de instalar "ioredis": npm install ioredis');
      throw err;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn({ err, key }, 'Erro ao ler cache Redis — ignorando');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    try {
      // PX = TTL em milissegundos
      await this.client.set(key, JSON.stringify(value), 'PX', ttlMs);
    } catch (err) {
      log.warn({ err, key }, 'Erro ao escrever no cache Redis — ignorando');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      log.warn({ err, key }, 'Erro ao deletar chave Redis — ignorando');
    }
  }

  /** Fecha a conexão graciosamente (chamar no shutdown) */
  async quit(): Promise<void> {
    await this.client.quit().catch(() => { });
  }
}

// ─── Factory — escolhe o backend baseado em REDIS_URL ─────────

let _cacheInstance: ICacheService | null = null;

export function getCache(): ICacheService {
  if (_cacheInstance) return _cacheInstance;

  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    try {
      _cacheInstance = new RedisCache(redisUrl);
      log.info('Cache backend: Redis');
    } catch {
      log.warn('Falha ao inicializar Redis — usando cache in-memory como fallback');
      _cacheInstance = new InMemoryCache();
    }
  } else {
    _cacheInstance = new InMemoryCache();
    log.info('Cache backend: in-memory (configure REDIS_URL para usar Redis em produção)');
  }

  return _cacheInstance;
}

/** Expõe o singleton para testes ou shutdown graceful */
export function resetCache(): void {
  _cacheInstance = null;
}