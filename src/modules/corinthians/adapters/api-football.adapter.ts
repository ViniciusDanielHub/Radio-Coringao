// src/modules/corinthians/adapters/api-football.adapter.ts
//
// Adapter para api-football via RapidAPI
// Plano gratuito: 100 req/dia — sem custo de cartão
// Cadastro: https://rapidapi.com/api-sports/api/api-football
//
// Variáveis de ambiente:
//   RAPIDAPI_KEY  — chave do RapidAPI
//   (alternativo: API_FOOTBALL_KEY — acesso direto via api-football.com)

import { CORINTHIANS_CONFIG } from '../corinthians.config';
import { getCache } from '../../../shared/services/cache';
import { ExternalServiceError } from '../../../shared/errors';
import { ErrorCode } from '../../../shared/errors/error-codes';
import type { CorinthiansMatch, Squad, TeamStats, TopScorer } from '../corinthians.types';

const { apis, ids, competitions, cache: TTL } = CORINTHIANS_CONFIG;

// ─── Decide qual endpoint usar ────────────────────────────────
function getBaseUrl(): { url: string; headers: Record<string, string> } {
  const rapidKey = process.env.RAPIDAPI_KEY?.trim();
  const directKey = process.env.API_FOOTBALL_KEY?.trim();

  if (rapidKey) {
    return {
      url: apis.apiFootball.rapidApiBaseUrl,
      headers: {
        'X-RapidAPI-Key': rapidKey,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
    };
  }
  if (directKey) {
    return {
      url: apis.apiFootball.baseUrl,
      headers: { 'x-apisports-key': directKey },
    };
  }
  return { url: '', headers: {} };
}

export function isApiFootballConfigured(): boolean {
  const rk = process.env.RAPIDAPI_KEY?.trim();
  const dk = process.env.API_FOOTBALL_KEY?.trim();
  return !!(rk || dk);
}

// ─── Helper de fetch com cache ────────────────────────────────
async function afFetch<T>(path: string, ttlMs: number): Promise<T> {
  const { url, headers } = getBaseUrl();
  if (!url) {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_KEY_MISSING, {
      source: 'api-football',
      hint: 'Configure RAPIDAPI_KEY (https://rapidapi.com/api-sports/api/api-football) ou API_FOOTBALL_KEY no .env',
      variables: ['RAPIDAPI_KEY', 'API_FOOTBALL_KEY'],
    });
  }

  const cacheKey = `af:${path}`;
  const cached = await getCache().get<T>(cacheKey);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(`${url}${path}`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
        source: 'api-football', path, hint: 'Timeout de 12 segundos.',
      });
    }
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      source: 'api-football', path, originalError: err.message,
    });
  }

  if (res.status === 429) {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_RATE_LIMITED, {
      source: 'api-football', hint: 'Limite de 100 req/dia atingido no plano gratuito.',
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      source: 'api-football', httpStatus: res.status, body, path,
    });
  }

  const data = await res.json() as any;

  // api-football retorna erros dentro do JSON com código 0
  if (data.results === 0 && data.errors && Object.keys(data.errors).length > 0) {
    throw new ExternalServiceError(ErrorCode.LIVE_SCORES_API_UNAVAILABLE, {
      source: 'api-football', apiErrors: data.errors, path,
    });
  }

  await getCache().set(cacheKey, data, ttlMs);
  return data as T;
}

// ─── Normalizar partida da api-football ──────────────────────
function normalizeMatch(raw: any): CorinthiansMatch {
  const f = raw.fixture;
  const t = raw.teams;
  const g = raw.goals;
  const s = raw.score;

  // Determina vencedor
  let winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null = null;
  if (f.status.short === 'FT' || f.status.short === 'AET' || f.status.short === 'PEN') {
    if (t.home.winner === true) winner = 'HOME_TEAM';
    else if (t.away.winner === true) winner = 'AWAY_TEAM';
    else if (t.home.winner === false && t.away.winner === false) winner = 'DRAW';
  }

  // Mapeia status
  const statusMap: Record<string, string> = {
    'TBD': 'SCHEDULED', 'NS': 'SCHEDULED', 'LIVE': 'IN_PLAY',
    '1H': 'IN_PLAY', 'HT': 'PAUSED', '2H': 'IN_PLAY', 'ET': 'IN_PLAY',
    'BT': 'PAUSED', 'P': 'IN_PLAY', 'INT': 'PAUSED', 'FT': 'FINISHED',
    'AET': 'FINISHED', 'PEN': 'FINISHED', 'PST': 'POSTPONED',
    'CANC': 'CANCELLED', 'ABD': 'SUSPENDED', 'AWD': 'AWARDED',
    'WO': 'AWARDED',
  };

  return {
    id: f.id,
    source: 'apifootball',
    competition: {
      id: raw.league?.id,
      name: raw.league?.name ?? '',
      emblem: raw.league?.logo,
    },
    matchday: raw.league?.round
      ? Number(raw.league.round.replace(/\D/g, '')) || null
      : null,
    utcDate: f.date,
    status: (statusMap[f.status.short] ?? 'SCHEDULED') as any,
    homeTeam: {
      id: t.home.id,
      name: t.home.name,
      shortName: t.home.name,
      crest: t.home.logo,
    },
    awayTeam: {
      id: t.away.id,
      name: t.away.name,
      shortName: t.away.name,
      crest: t.away.logo,
    },
    score: {
      winner,
      fullTime: { home: g.home ?? null, away: g.away ?? null },
      halfTime: {
        home: s?.halftime?.home ?? null,
        away: s?.halftime?.away ?? null,
      },
      extraTime: {
        home: s?.extratime?.home ?? null,
        away: s?.extratime?.away ?? null,
      },
      penalties: {
        home: s?.penalty?.home ?? null,
        away: s?.penalty?.away ?? null,
      },
    },
    venue: f.venue?.name ?? null,
    referees: (raw.lineups ?? []).flatMap((l: any) => []),
  };
}

// ═══════════════════════════════════════════════════════════════
// Funções públicas
// ═══════════════════════════════════════════════════════════════

/**
 * Próximos jogos do Corinthians (todas competições)
 */
export async function getNextMatchesAF(limit = 5): Promise<CorinthiansMatch[]> {
  const season = competitions.brasileirao.season;
  const data = await afFetch<any>(
    `/fixtures?team=${ids.apiFootball}&next=${Math.min(limit, 20)}&season=${season}`,
    TTL.scheduledMatches,
  );
  return (data.response ?? []).map(normalizeMatch).slice(0, limit);
}

/**
 * Resultados recentes do Corinthians
 */
export async function getRecentMatchesAF(limit = 5): Promise<CorinthiansMatch[]> {
  const season = competitions.brasileirao.season;
  const data = await afFetch<any>(
    `/fixtures?team=${ids.apiFootball}&last=${Math.min(limit, 20)}&season=${season}`,
    TTL.recentMatches,
  );
  return (data.response ?? [])
    .map(normalizeMatch)
    .sort((a: any, b: any) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, limit);
}

/**
 * Jogo ao vivo do Corinthians (se houver)
 */
export async function getLiveMatchAF(): Promise<CorinthiansMatch | null> {
  const data = await afFetch<any>(
    `/fixtures?team=${ids.apiFootball}&live=all`,
    TTL.liveMatch,
  );
  const matches = (data.response ?? []).map(normalizeMatch);
  return matches[0] ?? null;
}

/**
 * Elenco atual do Corinthians
 */
export async function getSquadAF(): Promise<Squad | null> {
  const season = competitions.brasileirao.season;
  const data = await afFetch<any>(
    `/players/squads?team=${ids.apiFootball}&season=${season}`,
    TTL.squad,
  );

  const team = data.response?.[0];
  if (!team) return null;

  return {
    teamId: team.team?.id ?? ids.apiFootball,
    teamName: team.team?.name ?? 'Corinthians',
    crest: team.team?.logo,
    season: String(season),
    coach: null, // requer endpoint separado no plano gratuito
    players: (team.players ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position ?? 'Unknown',
      nationality: p.nationality ?? '',
      dateOfBirth: p.birth?.date ?? null,
      shirtNumber: p.number ?? null,
    })),
  };
}

/**
 * Estatísticas do Corinthians no Brasileirão
 */
export async function getTeamStatsAF(): Promise<TeamStats | null> {
  const season = competitions.brasileirao.season;
  const data = await afFetch<any>(
    `/teams/statistics?team=${ids.apiFootball}&league=${competitions.brasileirao.apiFootballId}&season=${season}`,
    TTL.stats,
  );

  const s = data.response;
  if (!s) return null;

  const played = s.fixtures?.played?.total ?? 0;
  const won = s.fixtures?.wins?.total ?? 0;
  const drawn = s.fixtures?.draws?.total ?? 0;
  const lost = s.fixtures?.loses?.total ?? 0;
  const goalsFor = s.goals?.for?.total?.total ?? 0;
  const goalsAgainst = s.goals?.against?.total?.total ?? 0;

  // Clean sheets — jogos sem sofrer gol
  const cleanSheets = (s.clean_sheet?.total ?? 0);

  // Forma recente (últimos 5)
  const formStr = s.form ?? '';
  const recentForm = formStr.slice(-5);

  return {
    teamId: s.team?.id ?? ids.apiFootball,
    teamName: s.team?.name ?? 'Corinthians',
    season: String(season),
    matches: {
      played,
      won,
      drawn,
      lost,
      home: {
        played: s.fixtures?.played?.home ?? 0,
        won: s.fixtures?.wins?.home ?? 0,
        drawn: s.fixtures?.draws?.home ?? 0,
        lost: s.fixtures?.loses?.home ?? 0,
      },
      away: {
        played: s.fixtures?.played?.away ?? 0,
        won: s.fixtures?.wins?.away ?? 0,
        drawn: s.fixtures?.draws?.away ?? 0,
        lost: s.fixtures?.loses?.away ?? 0,
      },
    },
    goals: {
      scored: goalsFor,
      conceded: goalsAgainst,
      difference: goalsFor - goalsAgainst,
    },
    points: (won * 3) + drawn,
    position: null, // calculado pela tabela
    form: recentForm || null,
    winRate: played > 0 ? `${((won / played) * 100).toFixed(2)}%` : '0%',
    averageGoalsScored: played > 0 ? (goalsFor / played).toFixed(2) : '0',
    averageGoalsConceded: played > 0 ? (goalsAgainst / played).toFixed(2) : '0',
    cleanSheets,
    biggestWin: s.biggest?.wins?.home ?? s.biggest?.wins?.away ?? null,
    biggestLoss: s.biggest?.loses?.home ?? s.biggest?.loses?.away ?? null,
  };
}

/**
 * Lesionados e suspensos do Corinthians
 */
export async function getInjuriesAF(): Promise<any[]> {
  const season = competitions.brasileirao.season;
  try {
    const data = await afFetch<any>(
      `/injuries?team=${ids.apiFootball}&season=${season}&league=${competitions.brasileirao.apiFootballId}`,
      TTL.stats,
    );
    return (data.response ?? []).map((item: any) => ({
      player: {
        id: item.player?.id,
        name: item.player?.name,
        photo: item.player?.photo,
      },
      reason: item.player?.reason ?? 'Desconhecido',
      fixture: {
        id: item.fixture?.id,
        date: item.fixture?.date,
      },
    }));
  } catch {
    return [];
  }
}