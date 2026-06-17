// src/modules/corinthians/corinthians.types.ts

// ─── Partidas ─────────────────────────────────────────────────
export interface CorinthiansMatch {
  id: number | string;
  source: 'football-data' | 'apifootball' | 'mock';
  competition: {
    id: number | string;
    name: string;
    emblem?: string;
  };
  matchday?: number | null;
  utcDate: string;           // ISO 8601
  status: MatchStatus;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  score: MatchScore;
  venue?: string | null;
  referees?: Referee[];
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'AWARDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'LIVE';

export interface TeamRef {
  id: number | string;
  name: string;
  shortName: string;
  tla?: string;
  crest?: string;
}

export interface MatchScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration?: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
  extraTime?: { home: number | null; away: number | null };
  penalties?: { home: number | null; away: number | null };
}

export interface Referee {
  name: string;
  role: string;
  nationality?: string;
}

// ─── Tabela do Brasileirão ────────────────────────────────────
export interface StandingRow {
  position: number;
  team: TeamRef;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null;        // ex: "W,L,D,W,W"
  isCorinthians?: boolean;
}

export interface BrasileiraoStandings {
  season: string;
  updatedAt: string;
  table: StandingRow[];
  corinthiansPosition: number | null;
  corinthiansRow: StandingRow | null;
}

// ─── Elenco ───────────────────────────────────────────────────
export interface Player {
  id: number | string;
  name: string;
  position: string;
  nationality: string;
  dateOfBirth?: string | null;
  shirtNumber?: number | null;
  marketValue?: string | null;
}

export interface Squad {
  teamId: number | string;
  teamName: string;
  crest?: string;
  season?: string;
  coach?: { name: string; nationality?: string } | null;
  players: Player[];
}

// ─── Artilheiros ─────────────────────────────────────────────
export interface TopScorer {
  player: { id: number | string; name: string; nationality: string };
  team: TeamRef;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

// ─── Estatísticas do time ─────────────────────────────────────
export interface TeamStats {
  teamId: number | string;
  teamName: string;
  season: string;
  matches: {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    home: { played: number; won: number; drawn: number; lost: number };
    away: { played: number; won: number; drawn: number; lost: number };
  };
  goals: {
    scored: number;
    conceded: number;
    difference: number;
  };
  points: number;
  position: number | null;
  form: string | null;        // últimos 5 resultados
  winRate: string;            // "60.00%"
  averageGoalsScored: string;
  averageGoalsConceded: string;
  cleanSheets: number;
  biggestWin: string | null;
  biggestLoss: string | null;
}

// ─── Widget resumo ────────────────────────────────────────────
export interface CorinthiansWidget {
  team: {
    id: number | string;
    name: string;
    shortName: string;
    tla: string;
    crest?: string;
    founded?: number;
    venue?: string;
    address?: string;
    website?: string;
    colors?: string;
  };
  currentSeason: string;
  standing: StandingRow | null;
  lastMatch: CorinthiansMatch | null;
  nextMatch: CorinthiansMatch | null;
  recentForm: string;          // ex: "WDLWW"
  stats: {
    points: number;
    position: number | null;
    goalsFor: number;
    goalsAgainst: number;
    played: number;
  };
  lastUpdated: string;
}

// ─── Configuração de fontes ───────────────────────────────────
export interface DataSourceStatus {
  name: string;
  available: boolean;
  configured: boolean;
  rateLimit?: string;
  note?: string;
}