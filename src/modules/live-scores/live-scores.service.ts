// src/modules/live-scores/live-scores.service.ts
import { LIVE_SCORES_CONFIG } from './live-scores.config';
import type { MatchResult, StandingRow, TopScorer, CorinthiansWidget } from './live-scores.types';
const { baseUrl, competition, teams, cache: TTL } = LIVE_SCORES_CONFIG;

// ─── Cache em memória ─────────────────────────────────────────
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cacheStore = new Map<string, CacheEntry>();

function fromCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data as T;
}

function toCache(key: string, data: unknown, ttlMs: number): void {
  cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Fetch com auth ───────────────────────────────────────────
async function apiFetch<T>(path: string, ttlMs: number): Promise<T> {
  const cached = fromCache<T>(path);
  if (cached) return cached;

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    throw new Error(
      'FOOTBALL_DATA_API_KEY não configurada. ' +
      'Cadastre-se em https://www.football-data.org/client/register',
    );
  }

  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org ${res.status}: ${body}`);
  }

  const data = (await res.json()) as T;
  toCache(path, data, ttlMs);
  return data;
}

// ─── Service ──────────────────────────────────────────────────
export class LiveScoresService {

  async getMatches(options: {
    matchday?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ matches: MatchResult[]; competition: unknown }> {
    const params = new URLSearchParams();
    if (options.matchday) params.set('matchday', String(options.matchday));
    if (options.status) params.set('status', options.status.toUpperCase());
    if (options.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params.set('dateTo', options.dateTo);

    const qs = params.toString();
    const path = `/competitions/${competition}/matches${qs ? `?${qs}` : ''}`;
    const ttl = options.status === 'IN_PLAY' ? TTL.inPlay : TTL.matches;
    return apiFetch(path, ttl);
  }

  async getStandings(): Promise<{ standings: { type: string; table: StandingRow[] }[] }> {
    return apiFetch(`/competitions/${competition}/standings`, TTL.standings);
  }

  async getTopScorers(limit = 10): Promise<{ scorers: TopScorer[] }> {
    return apiFetch(`/competitions/${competition}/scorers?limit=${limit}`, TTL.scorers);
  }

  async getTeamMatches(
    teamId: number,
    options: { status?: string; limit?: number } = {},
  ): Promise<{ matches: MatchResult[] }> {
    const params = new URLSearchParams();
    if (options.status) params.set('status', options.status.toUpperCase());
    params.set('competitions', competition);
    params.set('limit', String(options.limit || 10));
    return apiFetch(`/teams/${teamId}/matches?${params}`, TTL.matches);
  }

  async getTeamSquad(teamId: number): Promise<unknown> {
    return apiFetch(`/teams/${teamId}`, TTL.squad);
  }

  async getCompetitionInfo(): Promise<unknown> {
    return apiFetch(`/competitions/${competition}`, TTL.competition);
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

    return {
      team: teamData,
      nextMatches: nextRes.matches,
      recentMatches: recentRes.matches,
      standing,
    };
  }
}