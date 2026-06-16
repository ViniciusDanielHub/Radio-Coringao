import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  // Em testes, silencia tudo para não poluir a saída
  level: isTest ? 'silent' : (process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info')),

  // Em dev usa pretty-print; em prod emite JSON puro para ser consumido por
  // agregadores de log (Datadog, CloudWatch, Loki, etc.)
  ...(isDev && !isTest
    ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }
    : {}),

  // Campos base presentes em todos os logs
  base: {
    env: process.env.NODE_ENV ?? 'development',
    service: 'sports-news-api',
  },

  // Serializa objetos Error de forma rica
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

// Re-exporta o tipo para uso em assinaturas de função
export type Logger = typeof logger;