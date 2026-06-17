// src/modules/corinthians/adapters/football-data.adapter.ts
//
// Adapter para a API football-data.org
// Plano gratuito: 10 req/min — BSA (Brasileirão Série A) incluso
// Cadastro: https://www.football-data.org/client/register
//
// Variável de ambiente: FOOTBALL_DATA_API_KEY

import { CORINTHIANS_CONFIG } from '../corinthians.config';
import { getCache } from '../../../shared/services/cache';
import { AppError, ExternalServiceError } from '../../../shared/errors';
import { ErrorCode } from '../../../shared/errors/error-codes';
import type {
  CorinthiansMatch,
  StandingRow,
  Squad,
  TopScorer,
  BrasileiraoStandings,
} from '../corinthians.types';

const { apis, ids, competitions, cache: TTL } = CORINTHIANS_CONFIG;

// ─── Helper de fetch com cache ────────────────────────────────
async function fdFetch<T>(path: string, ttlMs: number): Promise<T> {
  const cacheKey = `fd:${path}`;
  const cached = await getCache().get<T>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();

  if (!apiKey || apiKey === 'sua_chave_aqui') {
    throw new AppError(
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      503,
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      {
        source: 'football-data.org',
        hint: 'Cadastre-se em https://www.football-data.org/client/register e configure FOOTBALL_DATA_API_KEY no .env',
        variable: 'FOOTBALL_DATA_API_KEY',
      },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${apis.footballData.baseUrl}${path}`, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
        source: 'football-data.org',
        path,
        hint: 'A API não respondeu em 10 segundos.',
      });
    }
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      source: 'football-data.org',
      path,
      originalError: err.message,
    });
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('X-RequestCounter-Reset');
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_RATE_LIMITED, {
      source: 'football-data.org',
      retryAfter,
      hint: 'O plano gratuito permite 10 req/min.',
    });
  }

  if (res.status === 401 || res.status === 403) {
    throw new AppError(ErrorCode.LIVE_SCORES_API_KEY_MISSING, 403,
      ErrorCode.LIVE_SCORES_API_KEY_MISSING,
      { source: 'football-data.org', hint: 'Verifique se FOOTBALL_DATA_API_KEY é válida.' });
  }

  if (res.status === 404) {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_TEAM_NOT_FOUND, {
      source: 'football-data.org', path,
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      source: 'football-data.org', httpStatus: res.status, body, path,
    });
  }

  const data = await res.json() as T;
  await getCache().set(cacheKey, data, ttlMs);
  return data;
}

// ─── Normalizar partida ───────────────────────────────────────
function normalizeMatch(raw: any): CorinthiansMatch {
  return {
    id: raw.id,
    source: 'football-data',
    competition: {
      id: raw.competition?.id,
      name: raw.competition?.name ?? '',
      emblem: raw.competition?.emblem,
    },
    matchday: raw.matchday ?? null,
    utcDate: raw.utcDate,
    status: raw.status,
    homeTeam: {
      id: raw.homeTeam?.id,
      name: raw.homeTeam?.name ?? '',
      shortName: raw.homeTeam?.shortName ?? raw.homeTeam?.name ?? '',
      tla: raw.homeTeam?.tla,
      crest: raw.homeTeam?.crest,
    },
    awayTeam: {
      id: raw.awayTeam?.id,
      name: raw.awayTeam?.name ?? '',
      shortName: raw.awayTeam?.shortName ?? raw.awayTeam?.name ?? '',
      tla: raw.awayTeam?.tla,
      crest: raw.awayTeam?.crest,
    },
    score: {
      winner: raw.score?.winner ?? null,
      duration: raw.score?.duration,
      fullTime: {
        home: raw.score?.fullTime?.home ?? null,
        away: raw.score?.fullTime?.away ?? null,
      },
      halfTime: {
        home: raw.score?.halfTime?.home ?? null,
        away: raw.score?.halfTime?.away ?? null,
      },
    },
    venue: raw.venue ?? null,
    referees: (raw.referees ?? []).map((r: any) => ({
      name: r.name,
      role: r.role,
      nationality: r.nationality,
    })),
  };
}

// ─── Normalizar linha da tabela ───────────────────────────────
function normalizeStandingRow(raw: any): StandingRow {
  return {
    position: raw.position,
    team: {
      id: raw.team?.id,
      name: raw.team?.name ?? '',
      shortName: raw.team?.shortName ?? raw.team?.name ?? '',
      tla: raw.team?.tla,
      crest: raw.team?.crest,
    },
    playedGames: raw.playedGames,
    won: raw.won,
    draw: raw.draw,
    lost: raw.lost,
    points: raw.points,
    goalsFor: raw.goalsFor,
    goalsAgainst: raw.goalsAgainst,
    goalDifference: raw.goalDifference,
    form: raw.form ?? null,
    isCorinthians: raw.team?.id === ids.footballData,
  };
}

// ═══════════════════════════════════════════════════════════════
// Funções públicas do adapter
// ═══════════════════════════════════════════════════════════════

/**
 * Busca todos os jogos do Corinthians no Brasileirão
 */
export async function getCorinthiansMatchesFD(options: {
  status?: string;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
} = {}): Promise<CorinthiansMatch[]> {
  const params = new URLSearchParams();
  params.set('competitions', competitions.brasileirao.footballDataCode);
  if (options.status) params.set('status', options.status.toUpperCase());
  if (options.dateFrom) params.set('dateFrom', options.dateFrom);
  if (options.dateTo) params.set('dateTo', options.dateTo);

  const path = `/teams/${ids.footballData}/matches?${params}`;
  const isLive = options.status?.toUpperCase() === 'IN_PLAY';
  const ttl = isLive ? TTL.liveMatch : TTL.scheduledMatches;

  const raw = await fdFetch<{ matches: any[] }>(path, ttl);
  const matches = (raw.matches ?? []).map(normalizeMatch);

  if (options.limit) return matches.slice(0, options.limit);
  return matches;
}

/**
 * Busca próximos jogos do Corinthians
 */
export async function getNextMatchesFD(limit = 5): Promise<CorinthiansMatch[]> {
  const path = `/teams/${ids.footballData}/matches?status=SCHEDULED&competitions=${competitions.brasileirao.footballDataCode}&limit=${Math.min(limit, 10)}`;
  const raw = await fdFetch<{ matches: any[] }>(path, TTL.scheduledMatches);
  return (raw.matches ?? [])
    .map(normalizeMatch)
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, limit);
}

/**
 * Busca resultados recentes do Corinthians
 */
export async function getRecentMatchesFD(limit = 5): Promise<CorinthiansMatch[]> {
  const path = `/teams/${ids.footballData}/matches?status=FINISHED&competitions=${competitions.brasileirao.footballDataCode}`;
  const raw = await fdFetch<{ matches: any[] }>(path, TTL.recentMatches);
  return (raw.matches ?? [])
    .map(normalizeMatch)
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, limit);
}

/**
 * Busca tabela completa do Brasileirão
 */
export async function getBrasileiraoStandingsFD(): Promise<BrasileiraoStandings> {
  const raw = await fdFetch<any>(
    `/competitions/${competitions.brasileirao.footballDataCode}/standings`,
    TTL.standings,
  );

  const total = raw.standings?.find((s: any) => s.type === 'TOTAL');
  const table: StandingRow[] = (total?.table ?? []).map(normalizeStandingRow);

  const corinthiansRow = table.find(r => r.team.id === ids.footballData) ?? null;

  return {
    season: String(raw.season?.startDate?.split('-')[0] ?? new Date().getFullYear()),
    updatedAt: new Date().toISOString(),
    table,
    corinthiansPosition: corinthiansRow?.position ?? null,
    corinthiansRow,
  };
}

/**
 * Busca informações e elenco do Corinthians
 */
export async function getSquadFD(): Promise<Squad> {
  const raw = await fdFetch<any>(`/teams/${ids.footballData}`, TTL.squad);

  return {
    teamId: raw.id,
    teamName: raw.name,
    crest: raw.crest,
    season: String(new Date().getFullYear()),
    coach: raw.coach ? {
      name: raw.coach.name,
      nationality: raw.coach.nationality,
    } : null,
    players: (raw.squad ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position ?? 'Unknow',
      nationality: p.nationality ?? '',
      dateOfBirth: p.dateOfBirth ?? null,
      shirtNumber: p.shirtNumber ?? null,
    })),
  };
}

/**
 * Busca artilheiros do Brasileirão
 */
export async function getTopScorersFD(limit = 10): Promise<TopScorer[]> {
  const raw = await fdFetch<any>(
    `/competitions/${competitions.brasileirao.footballDataCode}/scorers?limit=${Math.min(limit, 20)}`,
    TTL.scorers,
  );
  return (raw.scorers ?? []).map((s: any) => ({
    player: {
      id: s.player?.id,
      name: s.player?.name ?? '',
      nationality: s.player?.nationality ?? '',
    },
    team: {
      id: s.team?.id,
      name: s.team?.name ?? '',
      shortName: s.team?.shortName ?? s.team?.name ?? '',
      tla: s.team?.tla,
      crest: s.team?.crest,
    },
    goals: s.goals ?? 0,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
  }));
}

/**
 * Verifica se a API está configurada e disponível
 */
export function isFootballDataConfigured(): boolean {
  const key = process.env.FOOTBALL_DATA_API_KEY?.trim();
  return !!key && key !== 'sua_chave_aqui';
}