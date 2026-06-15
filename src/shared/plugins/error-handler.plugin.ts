// src/shared/plugins/error-handler.plugin.ts
import type { FastifyInstance } from 'fastify';
import { AppError } from '../errors';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err, request, reply) => {
    console.error('❌ Erro:', err.message);

    // Prisma errors
    if ((err as any).code === 'P2002') {
      const field = (err as any).meta?.target?.[0] || 'campo';
      return reply.code(409).send({ error: `Já existe um registro com esse ${field}.` });
    }
    if ((err as any).code === 'P2025') {
      return reply.code(404).send({ error: 'Registro não encontrado.' });
    }

    // Multipart / file size
    if (err.message === 'File size limit reached') {
      return reply.code(400).send({ error: 'Arquivo muito grande. Máximo: 5MB.' });
    }

    // Application errors
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.message });
    }

    // Validation errors (set by routes)
    if ((err as any).validation) {
      return reply.code(422).send({
        error: 'Dados inválidos.',
        details: (err as any).validation,
      });
    }

    const status = err.statusCode || 500;
    const message =
      process.env.NODE_ENV === 'production' && status === 500
        ? 'Erro interno do servidor.'
        : err.message || 'Erro interno do servidor.';

    reply.code(status).send({ error: message });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: `Rota não encontrada: ${request.method} ${request.url}` });
  });
}
