// src/modules/live-scores/live-scores.controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LiveScoresService } from './live-scores.service';

export class LiveScoresController {
  constructor(private readonly service: LiveScoresService) { }

  getMatches = async (request: FastifyRequest, reply: FastifyReply) => {
    const { matchday, status, dateFrom, dateTo } = request.query as {
      matchday?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const data = await this.service.getMatches({
      matchday: matchday ? Number(matchday) : undefined,
      status,
      dateFrom,
      dateTo,
    });

    return reply.send(data);
  };

  getStandings = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.getStandings();
    return reply.send(data);
  };

  getTopScorers = async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit } = request.query as { limit?: string };
    const data = await this.service.getTopScorers(limit ? Number(limit) : 10);
    return reply.send(data);
  };

  getTeamMatches = async (request: FastifyRequest, reply: FastifyReply) => {
    const { teamId } = request.params as { teamId: string };
    const { status, limit } = request.query as { status?: string; limit?: string };

    const data = await this.service.getTeamMatches(Number(teamId), {
      status,
      limit: limit ? Number(limit) : 10,
    });

    return reply.send(data);
  };

  getTeamSquad = async (request: FastifyRequest, reply: FastifyReply) => {
    const { teamId } = request.params as { teamId: string };
    const data = await this.service.getTeamSquad(Number(teamId));
    return reply.send(data);
  };

  getCompetitionInfo = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.getCompetitionInfo();
    return reply.send(data);
  };

  getCorinthiansWidget = async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await this.service.getCorinthiansWidget();
    return reply.send(data);
  };
}