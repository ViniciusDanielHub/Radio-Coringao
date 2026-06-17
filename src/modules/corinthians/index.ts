// src/modules/corinthians/index.ts
export { corinthiansRoutes } from './corinthians.routes';
export { CorinthiansService, corinthiansService } from './corinthians.service';
export { CORINTHIANS_CONFIG } from './corinthians.config';
export type {
  CorinthiansMatch,
  BrasileiraoStandings,
  StandingRow,
  Squad,
  Player,
  TeamStats,
  TopScorer,
  CorinthiansWidget,
  DataSourceStatus,
  MatchStatus,
} from './corinthians.types';