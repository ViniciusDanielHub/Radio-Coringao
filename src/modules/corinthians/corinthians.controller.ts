// src/modules/corinthians/corinthians.controller.ts

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CorinthiansService } from './corinthians.service';

export class CorinthiansController {
  constructor(private readonly service: CorinthiansService) { }

  // GET /api/corinthians
  getWidget = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getWidget());
  };

  // GET /api/corinthians/matches
  getAllMatches = async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, limit, dateFrom, dateTo, competition } = request.query as {
      status?: string;
      limit?: string;
      dateFrom?: string;
      dateTo?: string;
      competition?: string;
    };
    return reply.send(
      await this.service.getAllMatches({
        status,
        limit: limit ? Number(limit) : undefined,
        dateFrom,
        dateTo,
        competition,
      }),
    );
  };

  // GET /api/corinthians/matches/next
  getNextMatches = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    return reply.send(await this.service.getNextMatches(limit ? Number(limit) : 5));
  };

  // GET /api/corinthians/matches/recent
  getRecentMatches = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    return reply.send(await this.service.getRecentMatches(limit ? Number(limit) : 5));
  };

  // GET /api/corinthians/matches/live
  getLiveMatch = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getLiveMatch());
  };

  // GET /api/corinthians/standings
  getStandings = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getBrasileiraoStandings());
  };

  // GET /api/corinthians/position
  getPosition = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getCorinthiansPosition());
  };

  // GET /api/corinthians/squad
  getSquad = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getSquad());
  };

  // GET /api/corinthians/stats
  getStats = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getStats());
  };

  // GET /api/corinthians/scorers
  getTopScorers = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    return reply.send(await this.service.getTopScorers(limit ? Number(limit) : 10));
  };

  // GET /api/corinthians/injuries
  getInjuries = async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await this.service.getInjuries());
  };

  // GET /api/corinthians/sources
  getSources = (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      message: 'Status das fontes de dados da API do Corinthians',
      sources: this.service.getDataSourcesStatus(),
      setup: {
        footballData: {
          variable: 'FOOTBALL_DATA_API_KEY',
          register: 'https://www.football-data.org/client/register',
          freeLimit: '10 req/min',
          provides: ['jogos', 'tabela', 'artilheiros'],
        },
        apiFootball: {
          variable: 'RAPIDAPI_KEY',
          register: 'https://rapidapi.com/api-sports/api/api-football',
          freeLimit: '100 req/dia',
          provides: ['elenco', 'estatísticas detalhadas', 'lesionados'],
        },
      },
    });
  };
}