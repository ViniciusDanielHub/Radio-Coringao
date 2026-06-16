import { LIVE_SCORES_CONFIG } from './live-scores.config';
import { ExternalServiceError, AppError } from '../../shared/errors';
import { ErrorCode } from '../../shared/errors/error-codes';
import { validateMatchday, validateDateRange, validateMatchStatus } from '../../shared/validators';
import { getCache } from '../../shared/services/cache';
import type { ICacheService } from '../../shared/services/cache';
import type { MatchResult, StandingRow, TopScorer } from './live-scores.types';

const { baseUrl, competition, teams, cache: TTL } = LIVE_SCORES_CONFIG;

async function apiFetch<T>(path: string, ttlMs: number, cache: ICacheService): Promise<T> {
  // Tenta ler do cache antes de bater na API
  const cached = await cache.get<T>(path);
  if (cached) return cached;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'sua_chave_aqui') {
    throw new AppError(
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      503,
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      {
        hint: 'Cadastre-se em https://www.football-data.org/client/register e configure FOOTBALL_DATA_API_KEY no .env',
        variable: 'FOOTBALL_DATA_API_KEY',
      },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
        hint: 'A API football-data.org não respondeu em 10 segundos.',
        path,
      });
    }
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      originalError: err.message,
      path,
    });
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('X-RequestCounter-Reset');
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_RATE_LIMITED, {
      retryAfter,
      hint: 'O plano gratuito permite 10 req/min. Considere fazer upgrade em football-data.org.',
    });
  }

  if (res.status === 403 || res.status === 401) {
    throw new AppError(
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      403,
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      { hint: 'Verifique se FOOTBALL_DATA_API_KEY é válida e está ativa.' },
    );
  }

  if (res.status === 404) {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND, { path });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => 'sem corpo');
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      httpStatus: res.status,
      body,
      path,
    });
  }

  let data: T;
  try {
    data = await res.json() as T;
  } catch {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      hint: 'Resposta da API não é um JSON válido.',
      path,
    });
  }

  // Persiste no cache (in-memory ou Redis)
  await cache.set(path, data, ttlMs);
  return data;
}

export class LiveScoresService {
  // Cache é lazy-loaded — usa o singleton configurado em getCache()
  private get cache(): ICacheService {
    return getCache();
  }

  async getMatches(options: {
    matchday?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ matches: MatchResult[]; competition: unknown }> {

    if (options.matchday !== undefined) validateMatchday(options.matchday);
    if (options.status) validateMatchStatus(options.status);
    if (options.dateFrom || options.dateTo) validateDateRange(options.dateFrom, options.dateTo);

    const params = new URLSearchParams();
    if (options.matchday) params.set('matchday', String(options.matchday));
    if (options.status) params.set('status', options.status.toUpperCase());
    if (options.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params.set('dateTo', options.dateTo);

    const qs = params.toString();
    const path = `/competitions/${competition}/matches${qs ? `?${qs}` : ''}`;
    const ttl = options.status?.toUpperCase() === 'IN_PLAY' ? TTL.inPlay : TTL.matches;

    return apiFetch(path, ttl, this.cache);
  }

  async getStandings(): Promise<{ standings: { type: string; table: StandingRow[] }[] }> {
    return apiFetch(`/competitions/${competition}/standings`, TTL.standings, this.cache);
  }

  async getTopScorers(limit = 10): Promise<{ scorers: TopScorer[] }> {
    if (limit < 1 || limit > 100) {
      throw new AppError(
        ErrorCode.PAGINATION_LIMIT_INVALID,
        400,
        ErrorCode.PAGINATION_LIMIT_INVALID,
        { received: limit, hint: 'Informe um valor entre 1 e 100.' },
      );
    }
    return apiFetch(`/competitions/${competition}/scorers?limit=${limit}`, TTL.scorers, this.cache);
  }

  async getTeamMatches(
    teamId: number,
    options: { status?: string; limit?: number } = {},
  ): Promise<{ matches: MatchResult[] }> {
    if (!teamId || !Number.isInteger(teamId) || teamId <= 0) {
      throw new AppError(
        ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND,
        400,
        ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND,
        { teamId, hint: 'O ID do time deve ser um inteiro positivo.' },
      );
    }
    if (options.status) validateMatchStatus(options.status);

    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status.toUpperCase());
    params.set('competitions', competition);
    params.set('limit', String(Math.min(options.limit ?? 10, 100)));

    return apiFetch(`/teams/${teamId}/matches?${params}`, TTL.matches, this.cache);
  }

  async getTeamSquad(teamId: number): Promise<unknown> {
    if (!teamId || !Number.isInteger(teamId) || teamId <= 0) {
      throw new AppError(
        ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND,
        400,
        ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND,
        { teamId },
      );
    }
    return apiFetch(`/teams/${teamId}`, TTL.squad, this.cache);
  }

  async getCompetitionInfo(): Promise<unknown> {
    return apiFetch(`/competitions/${competition}`, TTL.competition, this.cache);
  }

  async getCorinthiansWidget(): Promise<{
    team: unknown;
    nextMatches: MatchResult[];
    recentMatches: MatchResult[];
    standing: StandingRow | null;
  }> {
    const corinthiansId = teams.corinthians;
    const [teamData, nextRes, recentRes, standingsRes] = await Promise.all([
      this.getTeamSquad(corinthiansId),
      this.getTeamMatches(corinthiansId, { status: 'SCHEDULED', limit: 5 }),
      this.getTeamMatches(corinthiansId, { status: 'FINISHED', limit: 5 }),
      this.getStandings(),
    ]);

    const table = standingsRes.standings.find((s) => s.type === 'TOTAL')?.table ?? [];
    const standing = table.find((row) => row.team.id === corinthiansId) ?? null;

    return { team: teamData, nextMatches: nextRes.matches, recentMatches: recentRes.matches, standing };
  }
}