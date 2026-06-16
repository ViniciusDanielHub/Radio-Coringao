export interface MatchResult {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  referees: { name: string; role: string }[];
}

export interface StandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form: string | null;
}

export interface TopScorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; crest: string };
  goals: number;
  assists: number | null;
  penalties: number | null;
}

export interface CorinthiansWidget {
  team: unknown;
  nextMatches: MatchResult[];
  recentMatches: MatchResult[];
  standing: StandingRow | null;
}