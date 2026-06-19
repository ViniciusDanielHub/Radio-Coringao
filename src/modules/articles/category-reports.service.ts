// src/modules/articles/category-reports.service.ts
//
// Orquestra os relatórios "artigos por categoria" e "mais lido por
// categoria" nos 3 recortes de período pedidos:
//   - thisMonth:    1º dia do mês atual  → agora
//   - last6Months:  1º dia de 6 meses atrás → agora
//   - thisYear:     1º de janeiro do ano atual → agora
//
// Cada período roda as duas queries (artigos por categoria + mais
// lido por categoria) em paralelo, e os 3 períodos também rodam em
// paralelo entre si — 6 queries no total, todas simultâneas.
import type { IArticleAdminRepository } from './repositories/article-admin.repository.interface';
import type {
  CategoryReportsResponse,
  CategoryReportPeriod,
  PeriodLabel,
} from './category-reports.types';

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export class CategoryReportsService {
  constructor(private readonly repo: IArticleAdminRepository) { }

  async getReports(): Promise<CategoryReportsResponse> {
    const now = new Date();

    const periods = {
      thisMonth: this._buildThisMonthLabel(now),
      last6Months: this._buildLast6MonthsLabel(now),
      thisYear: this._buildThisYearLabel(now),
    };

    const [thisMonth, last6Months, thisYear] = await Promise.all([
      this._buildPeriodReport(periods.thisMonth),
      this._buildPeriodReport(periods.last6Months),
      this._buildPeriodReport(periods.thisYear),
    ]);

    return { thisMonth, last6Months, thisYear };
  }

  // ─── Monta um período individual (2 queries em paralelo) ────
  private async _buildPeriodReport(period: PeriodLabel): Promise<CategoryReportPeriod> {
    const range = { from: new Date(period.from), to: new Date(period.to) };

    const [articlesByCategory, mostReadByCategory] = await Promise.all([
      this.repo.getArticlesByCategory(range),
      this.repo.getMostReadByCategory(range),
    ]);

    return { period, articlesByCategory, mostReadByCategory };
  }

  // ─── Rótulos de período ──────────────────────────────────────

  private _buildThisMonthLabel(now: Date): PeriodLabel {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const to = now;
    return {
      key: 'thisMonth',
      label: `${MONTH_NAMES_PT[now.getMonth()]}/${now.getFullYear()}`,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  private _buildLast6MonthsLabel(now: Date): PeriodLabel {
    // "Últimos 6 meses" inclui o mês atual + 5 anteriores completos,
    // mesma convenção de janela usada em getArticlesPerMonth/getReadsPerMonth.
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
    const to = now;
    return {
      key: 'last6Months',
      label: 'Últimos 6 meses',
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  private _buildThisYearLabel(now: Date): PeriodLabel {
    const from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = now;
    return {
      key: 'thisYear',
      label: String(now.getFullYear()),
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
}