// src/modules/corinthians/corinthians.service.ts
//
// Orquestra os adapters, aplica fallback entre fontes,
// e calcula estatísticas derivadas.

import { CORINTHIANS_CONFIG } from './corinthians.config';
import { getCache } from '../../shared/services/cache';
import { logger } from '../../shared/logger';

import * as FD from './adapters/football-data.adapter';
import * as AF from './adapters/api-football.adapter';

import type {
  CorinthiansMatch,
  BrasileiraoStandings,
  Squad,
  TeamStats,
  CorinthiansWidget,
  DataSourceStatus,
  TopScorer,
} from './corinthians.types';

const { cache: TTL, club, ids, limits } = CORINTHIANS_CONFIG;
const log = logger.child({ service: 'CorinthiansService' });

// ─── Helper: executa fn com fallback ─────────────────────────
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback?: () => Promise<T>,
  label = 'unknown',
): Promise<T> {
  try {
    return await primary();
  } catch (err: any) {
    log.warn({ err: err.message, label }, 'Fonte primária falhou, tentando fallback');
    if (fallback) return fallback();
    throw err;
  }
}

// ─── Calcula forma recente a partir de partidas ───────────────
function calculateForm(
  matches: CorinthiansMatch[],
  corinthiansId: number | string,
  n = 5,
): string {
  return matches
    .filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, n)
    .map(m => {
      const isHome = String(m.homeTeam.id) === String(corinthiansId);
      const w = m.score.winner;
      if (!w) return 'D';
      if (w === 'HOME_TEAM') return isHome ? 'W' : 'L';
      if (w === 'AWAY_TEAM') return isHome ? 'L' : 'W';
      return 'D';
    })
    .join('');
}

// ═══════════════════════════════════════════════════════════════
export class CorinthiansService {

  // ─── Próximos jogos ────────────────────────────────────────
  async getNextMatches(limit = 5): Promise<{
    source: string;
    count: number;
    matches: CorinthiansMatch[];
  }> {
    const n = Math.min(limit, limits.maxMatches);

    if (FD.isFootballDataConfigured()) {
      const matches = await withFallback(
        () => FD.getNextMatchesFD(n),
        AF.isApiFootballConfigured() ? () => AF.getNextMatchesAF(n) : undefined,
        'nextMatches',
      );
      return { source: 'football-data.org', count: matches.length, matches };
    }

    if (AF.isApiFootballConfigured()) {
      const matches = await AF.getNextMatchesAF(n);
      return { source: 'api-football', count: matches.length, matches };
    }

    throw new Error('Nenhuma API configurada. Configure FOOTBALL_DATA_API_KEY ou RAPIDAPI_KEY no .env');
  }

  // ─── Resultados recentes ───────────────────────────────────
  async getRecentMatches(limit = 5): Promise<{
    source: string;
    count: number;
    matches: CorinthiansMatch[];
  }> {
    const n = Math.min(limit, limits.maxMatches);

    if (FD.isFootballDataConfigured()) {
      const matches = await withFallback(
        () => FD.getRecentMatchesFD(n),
        AF.isApiFootballConfigured() ? () => AF.getRecentMatchesAF(n) : undefined,
        'recentMatches',
      );
      return { source: 'football-data.org', count: matches.length, matches };
    }

    if (AF.isApiFootballConfigured()) {
      const matches = await AF.getRecentMatchesAF(n);
      return { source: 'api-football', count: matches.length, matches };
    }

    throw new Error('Nenhuma API configurada.');
  }

  // ─── Todos os jogos (com filtros) ─────────────────────────
  async getAllMatches(options: {
    status?: string;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
    competition?: string;
  } = {}): Promise<{
    source: string;
    count: number;
    filters: typeof options;
    matches: CorinthiansMatch[];
  }> {
    const limit = Math.min(options.limit ?? limits.defaultMatches, limits.maxMatches);

    if (FD.isFootballDataConfigured()) {
      const matches = await FD.getCorinthiansMatchesFD({
        status: options.status,
        limit,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
      });
      return {
        source: 'football-data.org',
        count: matches.length,
        filters: options,
        matches,
      };
    }

    if (AF.isApiFootballConfigured()) {
      // Fallback: decide entre próximos ou recentes
      const matches = options.status === 'FINISHED'
        ? await AF.getRecentMatchesAF(limit)
        : await AF.getNextMatchesAF(limit);
      return {
        source: 'api-football',
        count: matches.length,
        filters: options,
        matches,
      };
    }

    throw new Error('Nenhuma API configurada.');
  }

  // ─── Jogo ao vivo ──────────────────────────────────────────
  async getLiveMatch(): Promise<{
    hasLiveMatch: boolean;
    match: CorinthiansMatch | null;
    checkedAt: string;
  }> {
    // Primeiro tenta football-data
    if (FD.isFootballDataConfigured()) {
      try {
        const matches = await FD.getCorinthiansMatchesFD({ status: 'IN_PLAY', limit: 1 });
        const match = matches[0] ?? null;
        return { hasLiveMatch: !!match, match, checkedAt: new Date().toISOString() };
      } catch (err: any) {
        log.warn({ err: err.message }, 'FD live check falhou');
      }
    }

    // Fallback: api-football
    if (AF.isApiFootballConfigured()) {
      const match = await AF.getLiveMatchAF();
      return { hasLiveMatch: !!match, match, checkedAt: new Date().toISOString() };
    }

    return { hasLiveMatch: false, match: null, checkedAt: new Date().toISOString() };
  }

  // ─── Tabela do Brasileirão ─────────────────────────────────
  async getBrasileiraoStandings(): Promise<BrasileiraoStandings> {
    if (!FD.isFootballDataConfigured()) {
      throw new Error(
        'Tabela do Brasileirão requer FOOTBALL_DATA_API_KEY. ' +
        'Cadastre-se em https://www.football-data.org/client/register',
      );
    }
    return FD.getBrasileiraoStandingsFD();
  }

  // ─── Posição do Corinthians na tabela ─────────────────────
  async getCorinthiansPosition(): Promise<{
    position: number | null;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    form: string | null;
    zone: 'title' | 'libertadores' | 'sulamericana' | 'relegation' | 'mid-table' | 'unknown';
    updatedAt: string;
  }> {
    const standings = await this.getBrasileiraoStandings();
    const row = standings.corinthiansRow;

    if (!row) {
      return {
        position: null, points: 0, played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, form: null,
        zone: 'unknown', updatedAt: new Date().toISOString(),
      };
    }

    // Determina a zona na tabela (Brasileirão tem 20 times)
    const pos = row.position;
    let zone: 'title' | 'libertadores' | 'sulamericana' | 'relegation' | 'mid-table';
    if (pos === 1) zone = 'title';
    else if (pos <= 4) zone = 'libertadores';
    else if (pos <= 12) zone = 'sulamericana';
    else if (pos >= 17) zone = 'relegation';
    else zone = 'mid-table';

    return {
      position: row.position,
      points: row.points,
      played: row.playedGames,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      form: row.form ?? null,
      zone,
      updatedAt: standings.updatedAt,
    };
  }

  // ─── Elenco ────────────────────────────────────────────────
  async getSquad(): Promise<Squad & { groupedByPosition: Record<string, any[]> }> {
    let squad: Squad | null = null;

    if (FD.isFootballDataConfigured()) {
      squad = await withFallback(
        () => FD.getSquadFD(),
        AF.isApiFootballConfigured() ? () => AF.getSquadAF() : undefined,
        'squad',
      );
    } else if (AF.isApiFootballConfigured()) {
      squad = await AF.getSquadAF();
    }

    if (!squad) {
      throw new Error('Nenhuma API configurada para buscar o elenco.');
    }

    // Agrupa por posição
    const positionOrder = ['Goalkeeper', 'Defence', 'Midfield', 'Offence', 'Unknown'];
    const grouped: Record<string, any[]> = {};

    for (const pos of positionOrder) {
      const group = squad.players.filter(p =>
        p.position?.toLowerCase().includes(pos.toLowerCase().split('ence')[0]) ||
        p.position === pos,
      );
      if (group.length > 0) grouped[pos] = group;
    }

    // Jogadores com posição não mapeada
    const mapped = new Set(Object.values(grouped).flat().map(p => p.id));
    const rest = squad.players.filter(p => !mapped.has(p.id));
    if (rest.length > 0) grouped['Outros'] = rest;

    return { ...squad, groupedByPosition: grouped };
  }

  // ─── Estatísticas ──────────────────────────────────────────
  async getStats(): Promise<TeamStats & { position?: number | null }> {
    if (!AF.isApiFootballConfigured()) {
      // Calcula estatísticas a partir dos resultados da FD
      if (!FD.isFootballDataConfigured()) {
        throw new Error('Configure FOOTBALL_DATA_API_KEY ou RAPIDAPI_KEY para obter estatísticas.');
      }

      const [recentRes, nextRes, standingsRes] = await Promise.allSettled([
        this.getRecentMatches(20),
        this.getNextMatches(5),
        this.getBrasileiraoStandings(),
      ]);

      const recent = recentRes.status === 'fulfilled' ? recentRes.value.matches : [];
      const standings = standingsRes.status === 'fulfilled' ? standingsRes.value : null;
      const row = standings?.corinthiansRow;

      const played = row?.playedGames ?? recent.length;
      const won = row?.won ?? recent.filter(m => {
        const isHome = String(m.homeTeam.id) === String(ids.footballData);
        return m.score.winner === (isHome ? 'HOME_TEAM' : 'AWAY_TEAM');
      }).length;
      const drawn = row?.draw ?? recent.filter(m => m.score.winner === 'DRAW').length;
      const lost = row?.lost ?? (played - won - drawn);

      return {
        teamId: ids.footballData,
        teamName: club.name,
        season: String(CORINTHIANS_CONFIG.competitions.brasileirao.season),
        matches: {
          played,
          won,
          drawn,
          lost,
          home: { played: 0, won: 0, drawn: 0, lost: 0 },
          away: { played: 0, won: 0, drawn: 0, lost: 0 },
        },
        goals: {
          scored: row?.goalsFor ?? 0,
          conceded: row?.goalsAgainst ?? 0,
          difference: row?.goalDifference ?? 0,
        },
        points: row?.points ?? (won * 3 + drawn),
        position: row?.position ?? null,
        form: calculateForm(recent, ids.footballData, 5) || row?.form || null,
        winRate: played > 0 ? `${((won / played) * 100).toFixed(2)}%` : '0%',
        averageGoalsScored: played > 0 ? ((row?.goalsFor ?? 0) / played).toFixed(2) : '0',
        averageGoalsConceded: played > 0 ? ((row?.goalsAgainst ?? 0) / played).toFixed(2) : '0',
        cleanSheets: 0,
        biggestWin: null,
        biggestLoss: null,
      };
    }

    const stats = await AF.getTeamStatsAF();
    if (!stats) throw new Error('Não foi possível obter estatísticas.');

    // Enriquece com posição da tabela
    let position: number | null = null;
    try {
      if (FD.isFootballDataConfigured()) {
        const standings = await FD.getBrasileiraoStandingsFD();
        position = standings.corinthiansPosition;
      }
    } catch { /* posição fica null */ }

    return { ...stats, position };
  }

  // ─── Artilheiros do Brasileirão ────────────────────────────
  async getTopScorers(limit = 10): Promise<{
    competition: string;
    season: string;
    source: string;
    count: number;
    scorers: TopScorer[];
  }> {
    if (!FD.isFootballDataConfigured()) {
      throw new Error('Artilheiros requerem FOOTBALL_DATA_API_KEY.');
    }

    const n = Math.min(limit, limits.maxScorers);
    const scorers = await FD.getTopScorersFD(n);

    return {
      competition: 'Brasileirão Série A',
      season: String(CORINTHIANS_CONFIG.competitions.brasileirao.season),
      source: 'football-data.org',
      count: scorers.length,
      scorers,
    };
  }

  // ─── Lesionados e suspensos ────────────────────────────────
  async getInjuries(): Promise<{
    source: string;
    count: number;
    available: boolean;
    players: any[];
  }> {
    if (!AF.isApiFootballConfigured()) {
      return {
        source: 'api-football',
        available: false,
        count: 0,
        players: [],
      };
    }

    const players = await AF.getInjuriesAF();
    return {
      source: 'api-football',
      available: true,
      count: players.length,
      players,
    };
  }

  // ─── Widget resumo ─────────────────────────────────────────
  async getWidget(): Promise<CorinthiansWidget> {
    const cacheKey = 'corinthians:widget';
    const cached = await getCache().get<CorinthiansWidget>(cacheKey);
    if (cached) return cached;

    const [nextRes, recentRes, standingsRes] = await Promise.allSettled([
      this.getNextMatches(3),
      this.getRecentMatches(5),
      FD.isFootballDataConfigured() ? this.getBrasileiraoStandings() : Promise.resolve(null),
    ]);

    const next = nextRes.status === 'fulfilled' ? nextRes.value.matches : [];
    const recent = recentRes.status === 'fulfilled' ? recentRes.value.matches : [];
    const standings = standingsRes.status === 'fulfilled' ? standingsRes.value : null;
    const row = standings?.corinthiansRow ?? null;
    const corinthiansId = FD.isFootballDataConfigured() ? ids.footballData : ids.apiFootball;

    const form = calculateForm(recent, corinthiansId, 5);

    const widget: CorinthiansWidget = {
      team: {
        id: ids.footballData,
        name: club.name,
        shortName: club.shortName,
        tla: club.tla,
        crest: club.crest,
        founded: club.founded,
        venue: club.venue,
        website: club.website,
        colors: club.colors,
      },
      currentSeason: String(CORINTHIANS_CONFIG.competitions.brasileirao.season),
      standing: row,
      lastMatch: recent[0] ?? null,
      nextMatch: next[0] ?? null,
      recentForm: form,
      stats: {
        points: row?.points ?? 0,
        position: row?.position ?? null,
        goalsFor: row?.goalsFor ?? 0,
        goalsAgainst: row?.goalsAgainst ?? 0,
        played: row?.playedGames ?? 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    await getCache().set(cacheKey, widget, TTL.widget);
    return widget;
  }

  // ─── Status das fontes de dados ────────────────────────────
  getDataSourcesStatus(): DataSourceStatus[] {
    return [
      {
        name: 'football-data.org',
        available: FD.isFootballDataConfigured(),
        configured: !!process.env.FOOTBALL_DATA_API_KEY?.trim(),
        rateLimit: '10 req/min',
        note: FD.isFootballDataConfigured()
          ? 'Ativo — Brasileirão, tabela, artilheiros'
          : 'Configure FOOTBALL_DATA_API_KEY. Cadastro gratuito em https://www.football-data.org/client/register',
      },
      {
        name: 'api-football (RapidAPI)',
        available: AF.isApiFootballConfigured(),
        configured: !!(process.env.RAPIDAPI_KEY?.trim() || process.env.API_FOOTBALL_KEY?.trim()),
        rateLimit: '100 req/dia',
        note: AF.isApiFootballConfigured()
          ? 'Ativo — elenco, estatísticas detalhadas, lesionados'
          : 'Opcional. Configure RAPIDAPI_KEY. Cadastro em https://rapidapi.com/api-sports/api/api-football',
      },
    ];
  }
}

export const corinthiansService = new CorinthiansService();