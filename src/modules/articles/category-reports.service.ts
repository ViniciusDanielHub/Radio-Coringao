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
  //
  // Todos os "from" abaixo são montados com Date.UTC — ver nota de
  // correção no topo do arquivo. O "to" é sempre `now`, que já é um
  // instante absoluto (sem ambiguidade de fuso).

  private _buildThisMonthLabel(now: Date): PeriodLabel {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const to = now;
    return {
      key: 'thisMonth',
      label: `${MONTH_NAMES_PT[now.getUTCMonth()]}/${now.getUTCFullYear()}`,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  private _buildLast6MonthsLabel(now: Date): PeriodLabel {
    // "Últimos 6 meses" inclui o mês atual + 5 anteriores completos,
    // mesma convenção de janela usada em getArticlesPerMonth/getReadsPerMonth.
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1, 0, 0, 0, 0));
    const to = now;
    return {
      key: 'last6Months',
      label: 'Últimos 6 meses',
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }

  private _buildThisYearLabel(now: Date): PeriodLabel {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const to = now;
    return {
      key: 'thisYear',
      label: String(now.getUTCFullYear()),
      from: from.toISOString(),
      to: to.toISOString(),
    };
  }
}