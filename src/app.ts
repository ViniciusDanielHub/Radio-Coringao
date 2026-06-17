// src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

import { registerErrorHandler } from './shared/plugins/error-handler.plugin';
import { authenticate } from './shared/plugins/auth.plugin';

import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/users.routes';
import { categoryPublicRoutes, categoryAdminRoutes } from './modules/categories/categories.routes';
import { tagPublicRoutes, tagAdminRoutes } from './modules/tags/tags.routes';
import { bannerPublicRoutes, bannerAdminRoutes } from './modules/banners/banners.routes';
import { menuPublicRoutes, menuAdminRoutes } from './modules/menu/menu.routes';
import { settingsPublicRoutes, settingsAdminRoutes } from './modules/settings/settings.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { articlePublicRoutes } from './modules/articles/public/articles-public.routes';
import { articleAdminRoutes } from './modules/articles/admin/articles-admin.routes';
import { liveScoresRoutes } from './modules/live-scores';

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  });

  // ─── Security ─────────────────────────────────────────────
  await app.register(helmet, { global: true });

  // ─── Compressão HTTP ──────────────────────────────────────
  // Comprime respostas automaticamente quando o cliente suporta
  // (Accept-Encoding: gzip, deflate, br).
  // Reduz significativamente o tamanho de respostas JSON grandes
  // (ex: listagens de artigos, standings do Brasileirão).
  await app.register(compress, {
    global: true,
    // Comprime apenas respostas acima de 1KB para evitar overhead em respostas pequenas
    threshold: 1024,
    // Prefere brotli (melhor compressão) → gzip → deflate
    encodings: ['br', 'gzip', 'deflate'],
  });

  // ─── CORS ─────────────────────────────────────────────────
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isDev = process.env.NODE_ENV === 'development';

  await app.register(cors, {
    origin: (origin, cb) => {
      // Em desenvolvimento permite requisições sem origin (Postman, curl, etc.)
      if (isDev && !origin) {
        return cb(null, true);
      }

      // Em produção, requisições sem origin (ex: curl direto) são bloqueadas
      // a menos que ALLOWED_ORIGINS esteja vazio (configuração permissiva explícita)
      if (!origin) {
        if (allowedOrigins.length === 0) return cb(null, true);
        return cb(new Error('Requisições sem origin não são permitidas em produção.'), false);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      cb(new Error(`Origem não permitida pelo CORS: ${origin}`), false);
    },
    credentials: true,
    // Headers expostos para o cliente (ex: para paginação)
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Total-Pages'],
  });

  // ─── Rate limiting ────────────────────────────────────────
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '15 minutes',
    errorResponseBuilder: () => ({ error: 'Muitas requisições, tente novamente em 15 minutos.' }),
  });

  // ─── Multipart (uploads) ──────────────────────────────────
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  // ─── Error handling ───────────────────────────────────────
  registerErrorHandler(app);

  // ─── Health check ─────────────────────────────────────────
  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  }));

  // ─── Auth ─────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' });

  // ─── Rotas públicas ───────────────────────────────────────
  await app.register(async (instance: FastifyInstance) => {
    await instance.register(articlePublicRoutes);
    await instance.register(categoryPublicRoutes);
    await instance.register(tagPublicRoutes);
    await instance.register(bannerPublicRoutes);
    await instance.register(menuPublicRoutes);
    await instance.register(settingsPublicRoutes);
    await instance.register(liveScoresRoutes, { prefix: '/live-scores' });
  }, { prefix: '/api' });

  // ─── Rotas admin (requer autenticação) ────────────────────
  await app.register(async (instance: FastifyInstance) => {
    instance.addHook('preHandler', authenticate);

    await instance.register(dashboardRoutes);
    await instance.register(userRoutes);
    await instance.register(articleAdminRoutes);
    await instance.register(categoryAdminRoutes);
    await instance.register(tagAdminRoutes);
    await instance.register(bannerAdminRoutes);
    await instance.register(menuAdminRoutes);
    await instance.register(settingsAdminRoutes);
  }, { prefix: '/api/admin' });

  return app;
}