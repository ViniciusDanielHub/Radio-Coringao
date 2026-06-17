// src/modules/corinthians/corinthians.config.ts
//
// APIS GRATUITAS UTILIZADAS:
// ─────────────────────────────────────────────────────────────
// 1. football-data.org  — Brasileirão Série A, jogos, tabela
//    Plano gratuito: 10 req/min, acesso ao BSA (Série A)
//    Cadastro: https://www.football-data.org/client/register
//    Env: FOOTBALL_DATA_API_KEY
//
// 2. api-football (RapidAPI) — Dados adicionais, elenco, stats
//    Plano gratuito: 100 req/dia
//    Cadastro: https://rapidapi.com/api-sports/api/api-football
//    Env: RAPIDAPI_KEY
//
// 3. Dados calculados localmente — estatísticas derivadas dos
//    resultados já obtidos pelas fontes acima (sem custo extra).
//
// ESTRATÉGIA DE FALLBACK:
//   football-data → api-football → cache → erro amigável
// ─────────────────────────────────────────────────────────────

export const CORINTHIANS_CONFIG = {

  // ─── IDs do Corinthians em cada API ──────────────────────
  ids: {
    footballData: 1779,        // football-data.org
    apiFootball: 131,          // api-football / RapidAPI
    sofascore: 1963,           // sofascore (referência)
    flashscore: 'corinthians', // flashscore (referência)
  },

  // ─── Metadados do clube ───────────────────────────────────
  club: {
    name: 'Sport Club Corinthians Paulista',
    shortName: 'Corinthians',
    tla: 'COR',
    founded: 1910,
    venue: 'Neo Química Arena',
    venueCapacity: 47605,
    city: 'São Paulo, SP',
    colors: 'Branco e Preto',
    website: 'https://www.corinthians.com.br',
    crest: 'https://crests.football-data.org/1782.png',
  },

  // ─── Competições monitoradas ──────────────────────────────
  competitions: {
    brasileirao: {
      footballDataCode: 'BSA',  // Brasileirão Série A
      apiFootballId: 71,        // api-football
      name: 'Brasileirão Série A',
      season: new Date().getFullYear(),
    },
    copaDoBrasil: {
      apiFootballId: 73,
      name: 'Copa do Brasil',
    },
    libertadores: {
      footballDataCode: 'CLI',
      apiFootballId: 13,
      name: 'Copa Libertadores',
    },
    sulAmericana: {
      apiFootballId: 11,
      name: 'Copa Sul-Americana',
    },
  },

  // ─── URLs base das APIs ───────────────────────────────────
  apis: {
    footballData: {
      baseUrl: 'https://api.football-data.org/v4',
      docsUrl: 'https://www.football-data.org/documentation/quickstart',
      registerUrl: 'https://www.football-data.org/client/register',
      freeLimit: '10 req/min',
    },
    apiFootball: {
      baseUrl: 'https://v3.football.api-sports.io',
      rapidApiBaseUrl: 'https://api-football-v1.p.rapidapi.com/v3',
      docsUrl: 'https://www.api-football.com/documentation-v3',
      registerUrl: 'https://dashboard.api-football.com/register',
      freeLimit: '100 req/dia',
    },
  },

  // ─── TTLs de cache (ms) ───────────────────────────────────
  cache: {
    liveMatch: 30_000,          // 30s  — partida ao vivo
    recentMatches: 5 * 60_000,  // 5min — resultados recentes
    scheduledMatches: 30 * 60_000, // 30min — jogos futuros
    standings: 10 * 60_000,     // 10min — tabela
    squad: 24 * 60 * 60_000,    // 24h   — elenco
    teamInfo: 24 * 60 * 60_000, // 24h   — info do time
    stats: 15 * 60_000,         // 15min — estatísticas
    widget: 5 * 60_000,         // 5min  — widget resumo
    scorers: 15 * 60_000,       // 15min — artilheiros
  },

  // ─── Limites de listagem ──────────────────────────────────
  limits: {
    defaultMatches: 10,
    maxMatches: 50,
    defaultScorers: 10,
    maxScorers: 30,
  },

} as const;