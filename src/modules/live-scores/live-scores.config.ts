// src/modules/live-scores/live-scores.config.ts
export const LIVE_SCORES_CONFIG = {
  baseUrl: 'https://api.football-data.org/v4',
  competition: 'BSA', // Brasileirão Série A

  teams: {
    corinthians: 1779,
    palmeiras: 1783,
    saoPaulo: 1784,
    santos: 1785,
    flamengo: 264,
    fluminense: 335,
    botafogo: 1803,
    vasco: 1819,
    atleticoMG: 1062,
    internacional: 119,
    gremio: 120,
  },

  cache: {
    inPlay: 30_000,       // 30s  — partidas ao vivo
    matches: 120_000,      // 2min — partidas normais
    standings: 5 * 60_000,   // 5min — tabela
    scorers: 5 * 60_000,   // 5min — artilheiros
    squad: 30 * 60_000,  // 30min — elenco
    competition: 60 * 60_000,  // 1h   — info da competição
  },
} as const;