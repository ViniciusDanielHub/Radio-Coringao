// src/modules/corinthians/corinthians.routes.ts
//
// Rotas públicas da API do Corinthians
// Prefix: /api/corinthians
//
// ENDPOINTS:
// ─────────────────────────────────────────────────────────────
// GET /api/corinthians
//   Widget resumo: posição, último jogo, próximo jogo, forma
//
// GET /api/corinthians/matches
//   Todos os jogos. Query params:
//     ?status=SCHEDULED|FINISHED|IN_PLAY|POSTPONED|CANCELLED
//     ?dateFrom=YYYY-MM-DD  &dateTo=YYYY-MM-DD
//     ?limit=10
//
// GET /api/corinthians/matches/next
//   Próximos jogos. Query: ?limit=5
//
// GET /api/corinthians/matches/recent
//   Resultados recentes. Query: ?limit=5
//
// GET /api/corinthians/matches/live
//   Jogo ao vivo (retorna hasLiveMatch: false se não houver)
//
// GET /api/corinthians/standings
//   Tabela completa do Brasileirão Série A
//
// GET /api/corinthians/position
//   Posição e estatísticas do Corinthians na tabela
//
// GET /api/corinthians/squad
//   Elenco atual agrupado por posição
//
// GET /api/corinthians/stats
//   Estatísticas do Corinthians na temporada
//
// GET /api/corinthians/scorers
//   Artilheiros do Brasileirão. Query: ?limit=10
//
// GET /api/corinthians/injuries
//   Lesionados e suspensos (requer RAPIDAPI_KEY)
//
// GET /api/corinthians/sources
//   Status das APIs configuradas e instruções de setup
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import { CorinthiansController } from './corinthians.controller';
import { corinthiansService } from './corinthians.service';

const controller = new CorinthiansController(corinthiansService);

export async function corinthiansRoutes(app: FastifyInstance): Promise<void> {

  // ─── Widget principal ─────────────────────────────────────
  app.get('/', controller.getWidget);

  // ─── Jogos ────────────────────────────────────────────────
  // IMPORTANTE: rotas estáticas (/live, /next, /recent) antes do param (:id)
  app.get('/matches/live', controller.getLiveMatch);
  app.get('/matches/next', controller.getNextMatches);
  app.get('/matches/recent', controller.getRecentMatches);
  app.get('/matches', controller.getAllMatches);

  // ─── Brasileirão ──────────────────────────────────────────
  app.get('/standings', controller.getStandings);
  app.get('/position', controller.getPosition);

  // ─── Elenco e stats ───────────────────────────────────────
  app.get('/squad', controller.getSquad);
  app.get('/stats', controller.getStats);
  app.get('/scorers', controller.getTopScorers);
  app.get('/injuries', controller.getInjuries);

  // ─── Info / debug ─────────────────────────────────────────
  app.get('/sources', controller.getSources);
}