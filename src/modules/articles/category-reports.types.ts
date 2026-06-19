// src/modules/articles/category-reports.types.ts
//
// Tipos usados pelos relatórios de "artigos por categoria" e
// "matéria mais lida por categoria", nos 3 recortes de período
// suportados: mês atual, últimos 6 meses, ano atual.

export interface CategoryArticleCount {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryColor: string | null;
  count: number;
}

export interface CategoryMostRead {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  categoryColor: string | null;
  article: {
    id: string;
    title: string;
    slug: string;
  } | null;
  totalReads: number;
  uniqueReaders: number;
}

export interface PeriodLabel {
  /** Identificador da janela de tempo do relatório */
  key: 'thisMonth' | 'last6Months' | 'thisYear';
  /** Rótulo amigável, ex: "Junho/2026", "Últimos 6 meses", "2026" */
  label: string;
  from: string; // ISO date
  to: string;   // ISO date
}

export interface CategoryReportPeriod {
  period: PeriodLabel;
  articlesByCategory: CategoryArticleCount[];
  mostReadByCategory: CategoryMostRead[];
}

export interface CategoryReportsResponse {
  thisMonth: CategoryReportPeriod;
  last6Months: CategoryReportPeriod;
  thisYear: CategoryReportPeriod;
}