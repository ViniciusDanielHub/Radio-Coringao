// src/modules/live-scores/live-scores.routes.ts
import type { FastifyInstance } from 'fastify';
import { LiveScoresService } from './live-scores.service';
import { LiveScoresController } from './live-scores.controller';

const service = new LiveScoresService();
const controller = new LiveScoresController(service);

export async function liveScoresRoutes(app: FastifyInstance): Promise<void> {

  // ─── Brasileirão Série A ──────────────────────────────────
  // GET /api/live-scores/matches
  // GET /api/live-scores/matches?matchday=18
  // GET /api/live-scores/matches?status=IN_PLAY
  // GET /api/live-scores/matches?dateFrom=2026-06-01&dateTo=2026-06-30
  app.get('/matches', controller.getMatches);

  // GET /api/live-scores/standings
  app.get('/standings', controller.getStandings);

  // GET /api/live-scores/scorers
  // GET /api/live-scores/scorers?limit=20
  app.get('/scorers', controller.getTopScorers);

  // GET /api/live-scores/competition
  app.get('/competition', controller.getCompetitionInfo);

  // ─── Times ────────────────────────────────────────────────
  // GET /api/live-scores/teams/1782/matches
  // GET /api/live-scores/teams/1782/matches?status=SCHEDULED&limit=5
  app.get('/teams/:teamId/matches', controller.getTeamMatches);

  // GET /api/live-scores/teams/1782/squad
  app.get('/teams/:teamId/squad', controller.getTeamSquad);

  // ─── Widget Corinthians ───────────────────────────────────
  // GET /api/live-scores/corinthians
  app.get('/corinthians', controller.getCorinthiansWidget);
}